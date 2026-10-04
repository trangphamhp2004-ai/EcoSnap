# EcoSnap — trạng thái backend và thiết lập xác thực

Dự án hiện tại: https://ecosnap.trangphamhp2004.chatgpt.site
Giữ quyền xem chỉ chủ sở hữu. Luồng AI đã được triển khai nhưng gọi OpenAI thật bị khóa ở backend; chưa thử ảnh thật hoặc phát sinh yêu cầu API có phí.

## Dữ liệu và phân quyền

Sites cung cấp D1 (DB) và R2 (BUCKET). Migration tạo bảng dữ liệu và 8 nhóm đã thống nhất; không nhập vật phẩm, lịch sử, chi phí, góp ý hoặc bài viết giả. Nội dung mới cần kiểm duyệt và nguồn trước khi xuất bản. Ảnh nhận diện được xem trước trên thiết bị; chỉ khi bật AI sau phê duyệt và người dùng đồng ý rồi bấm nhận diện mới gửi qua backend tới OpenAI. EcoSnap không lưu ảnh vào D1/R2 hoặc nhật ký. Tệp góp ý JPG/PNG/WebP/PDF tối đa 5 MB được lưu riêng, chỉ admin tải qua API đã kiểm tra quyền.

Xác thực dùng Supabase Auth SDK phía server. Google/email chưa hoạt động khi chưa có cấu hình. Không dùng tài khoản thử thay xác thực. Supabase giữ mật khẩu và xác thực email; D1 giữ hồ sơ/role. Các API xác minh người dùng với Supabase mỗi yêu cầu, kiểm tra quyền ở server, dùng cookie HttpOnly/Secure/SameSite. Không dùng service-role key.

## Chủ website cần cấu hình

1. Dùng dự án Supabase do bạn quản lý; kiểm tra điều kiện gói đang chọn. Không nâng cấp hay bật dịch vụ trả phí tự động.
2. Trong Authentication → URL Configuration, đặt Site URL thành `https://ecosnap.trangphamhp2004.chatgpt.site`; cho phép redirect `https://ecosnap.trangphamhp2004.chatgpt.site/api/ecosnap/auth/callback**` (đường dẫn này kèm tham số next). Không cho phép wildcard toàn bộ domain khác.
3. Bật đăng nhập Email và xác minh email. Thiết lập gửi email xác minh/khôi phục; dịch vụ email mặc định có hạn chế nên phải kiểm tra người nhận được phép và cấu hình SMTP của bạn nếu cần. Nhập thông tin SMTP trực tiếp ở Supabase, không gửi mật khẩu vào hội thoại.
4. Bật Google provider trong Supabase. Tạo Google OAuth web client trong tài khoản Google Cloud của bạn; đặt callback đúng URL Supabase hiển thị. Nhập Client ID/secret trực tiếp vào Supabase. Nếu ứng dụng Google ở chế độ thử nghiệm, thêm email cần thử vào danh sách test users.
5. Trong phần biến môi trường của Sites, đặt `SUPABASE_URL` và `SUPABASE_PUBLISHABLE_KEY` từ dự án đó. Đây là key publishable, không dùng secret/service-role key. Nhập ở trang cài đặt, không dán bí mật vào chat.
6. Sau khi chủ sở hữu xác nhận email admin, đặt `ECOSNAP_ADMIN_EMAIL` tương ứng. Chỉ tài khoản có email đã xác minh trùng cấu hình được cấp quyền. Người đăng ký không được chọn vai trò. Đổi biến này không tự thu hồi admin đã cấp; cần thao tác bảo trì có kiểm soát để thu hồi.
7. Áp dụng cấu hình và cập nhật cùng dự án Sites. Thử Google, đăng ký/xác minh email, đăng xuất, quên mật khẩu trên trình duyệt. Liên kết email PKCE phải mở trên cùng trình duyệt đã bắt đầu yêu cầu. Site riêng tư vẫn yêu cầu quyền xem Sites trước lớp đăng nhập EcoSnap.

## Nhận diện ảnh và khóa phát hành

`lib/server/ai-policy.ts` đặt `LIVE_OPENAI_ENABLED = false`. Đây là khóa trong mã backend, không có biến môi trường, tham số trình duyệt, chế độ mock hay nút quản trị để vượt qua. Giữ nguyên secret `OPENAI_API_KEY` trên Sites. Chỉ sửa khóa này trong một bản cập nhật được chủ sở hữu phê duyệt sau khi rà soát điều kiện thử nghiệm.

Frontend giữ các trang và kiểu giao diện hiện có. Chụp/tải JPG, PNG, WEBP tối đa 10 MB, xem trước, thu nhỏ cạnh dài tối đa 1280 px và mã hóa lại JPEG (bỏ EXIF); xác nhận đồng ý gửi OpenAI. Backend kiểm tra kiểu/dung lượng/kích thước ảnh, bỏ các khối metadata JPEG, gửi inline tới Responses API với `store:false`, không dùng Files API hay lưu blob. OpenAI có chính sách lưu giữ riêng; `store:false` không đồng nghĩa Zero Data Retention. UI liên kết chính sách này.

Adapter dùng `gpt-4.1-mini-2025-04-14`, schema JSON chặt, giới hạn 512 output token, không có công cụ và không tự retry. AI chỉ xuất tên/nhóm, độ chắc chắn và định danh ứng viên. Backend chỉ chấp nhận ứng viên chính xác trong catalog đã kiểm duyệt, đã xuất bản, có nguồn và có các bước hướng dẫn; kiểm tra tên/nhóm trùng và độ chắc chắn >= 0.85. Không ép chọn vật phẩm gần giống. Không có hướng dẫn phù hợp thì hiển thị thiếu hướng dẫn, không trừ lượt. Catalog tối đa 100 mục/20 KB mô tả; mục ngoài phạm vi này cần tra cứu thủ công. Độ chính xác/ngưỡng cần đánh giá bằng ảnh thật trước phát hành AI.

Người dùng xác nhận hoặc tự chọn lại trong kho nội dung đã kiểm duyệt. Backend kiểm tra quyền sở hữu yêu cầu, phiên bản nội dung hiện tại, lưu lịch sử một lần. Hướng dẫn bị ẩn/đổi sẽ yêu cầu kiểm tra lại. Không lưu hướng dẫn do AI tạo. Xem lại kết quả hoặc tra cứu thủ công không gọi AI và không trừ lượt.

## Hạn mức, đồng thời và thời gian

5 lượt có kết quả/ngày, 20/tháng, giới hạn cứng tại backend, múi giờ Asia/Ho_Chi_Minh. Lượt bổ sung trước đây được giữ trong dữ liệu nhưng không vượt qua giới hạn này; chức năng cấp thêm được tạm tắt trong trang hiện có. Ngày/tháng của yêu cầu được chốt khi tiếp nhận. Kết quả thành công được tính khi backend trả ứng viên hợp lệ, không phải khi người dùng bấm xác nhận.

SQL giữ chỗ nguyên tử tính cả pending; mỗi người dùng chỉ có một yêu cầu pending, khóa request duy nhất gắn với hash ảnh có phân tách theo người dùng. Cùng khóa trả lại kết quả cũ, không gọi provider lần nữa; cùng khóa khác ảnh bị từ chối. Khác khóa khi tài khoản đang xử lý trả 409. Trình duyệt phục hồi phản hồi bị mất bằng GET theo khóa, không gửi lại ảnh. Giao diện làm mới hạn mức định kỳ và khi lấy lại tiêu điểm.

Unknown, lỗi kỹ thuật, thiếu hướng dẫn không trừ lượt. Ba unknown liên tiếp tạo cooldown 10 phút; nhận diện xác định được (kể cả thiếu hướng dẫn) xóa chuỗi unknown; lỗi kỹ thuật không tăng hoặc xóa chuỗi. Timeout provider 25 giây. Pending quá 120 giây được kết thúc lỗi và giải phóng lượt; toàn bộ dự phòng vẫn được tính là chi phí ước tính. Kết quả đến muộn không ghi đè trạng thái đã kết thúc, tránh vượt hạn mức.

## Ngân sách và chi phí

Trần cứng 5.000.000 VND/tháng. Cảnh báo do backend xác định ở 3.500.000 và 4.500.000 VND, bao gồm chi phí đã ghi nhận và đang giữ chỗ; hiển thị trên trang quản trị. Không tự gửi email/thông báo ra ngoài.

Giá chuẩn đã đối chiếu tài liệu OpenAI ngày 02/10/2026: input $0.40/triệu token, output $1.60/triệu token. Tỷ giá nội bộ bảo thủ 30.000 VND/USD là chính sách dự toán, không phải tỷ giá giao dịch thực tế. Dự phòng tối thiểu 12.596 VND/yêu cầu bao phủ toàn bộ context 1.047.576 token của model cộng 512 output token, dù yêu cầu thông thường nhỏ hơn nhiều. Backend không cho giảm dự phòng dưới cận này; không dùng chi phí từ trình duyệt. Usage hợp lệ của provider quyết định chi phí quy đổi theo mức uncached và làm tròn lên; phần dự phòng không dùng được giải phóng khi settle. Không xác nhận được usage (timeout, network, HTTP error...) thì giữ toàn bộ dự phòng thành chi phí ước tính, kể cả khi thực tế có thể không bị tính phí. Trang quản trị tách khoản này để đối soát sau.

Phạm vi trần là các lệnh nhận diện do EcoSnap gửi qua adapter này. Không bao phủ sử dụng cùng khóa bởi ứng dụng khác, thuế/phí thanh toán hoặc thay đổi bảng giá. Trước khi bật thật phải xác minh model/quyền truy cập, giá, tỷ giá dự toán và chi phí trên OpenAI; không tự bật hoặc gọi API để kiểm tra.

Nguồn: https://developers.openai.com/api/docs/models/gpt-4.1-mini ; https://developers.openai.com/api/docs/guides/structured-outputs ; https://developers.openai.com/api/docs/guides/your-data

## Kiểm thử và giới hạn

`node tests/backend.mjs` chạy migration thật trên SQLite và mã API/adapter thật với transport OpenAI giả lập; mọi fetch toàn cục bị chặn. Auth/R2 dùng fixture. Có kiểm tra nhiều kết nối SQLite ở worker threads, không chỉ Promise.all trên một kết nối. Cơ sở dữ liệu chỉ nằm trong `.backend-tests` và được xóa khi hoàn tất; không nhập dữ liệu thử lên Sites.

`node node_modules/typescript/bin/tsc --noEmit --incremental false` kiểm tra kiểu. `tests/ui.mjs` là bộ Playwright dùng route fixture và chặn request ngoài localhost; không nằm trong luồng runtime. Trong môi trường hiện tại Chrome headless không khởi động được, nên kiểm tra tương tác thực hiện qua trình duyệt tích hợp với proxy fixture riêng trên loopback. Dữ liệu/auth/OpenAI ở các kiểm tra này đều là giả lập.

Chưa xác minh bằng ảnh thật: độ chính xác tên/nhóm/chất liệu, từ chối ảnh mờ/nhiều vật, độ trễ và usage thực; quyền model của secret; điều kiện lưu giữ OpenAI; hành vi camera/quyền chụp trên điện thoại thật; đăng nhập và D1/R2 thật trong luồng nhận diện. Không khẳng định AI đang hoạt động thực tế. Không chạy API có phí khi bàn giao.
