# EcoSnap — thiết lập backend cho bản mã nguồn công khai

## Trạng thái

Bản xuất từ website phiên bản 10 ngày 03/10/2026. Website tham khảo đã công khai tại https://ecosnap.trangphamhp2004.chatgpt.site/; repo không có quyền triển khai vào website đó. Hai cổng `LIVE_OPENAI_ENABLED` và `ADMIN_TRIAL_ENABLED` trong `lib/server/ai-policy.ts` đều là `false`.

Nếu chỉ cần đọc/chấm hoặc kiểm thử, dùng `node tests/backend.mjs` hoặc giao diện fixture trong README. Không cần khóa OpenAI hay tài khoản dịch vụ cho bộ kiểm thử.

## Dịch vụ của bản triển khai độc lập

- Cloudflare Worker chạy backend Vinext; D1 binding `DB` chứa dữ liệu; R2 binding `BUCKET` lưu tệp góp ý có kiểm soát quyền.
- Supabase Auth quản lý đăng nhập Google/email. Backend xác minh phiên và email; vai trò admin không do trình duyệt tự chọn.
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ECOSNAP_ADMIN_EMAIL` là biến cấu hình. `.env.example` chứa giá trị trống. `OPENAI_API_KEY` chỉ đặt dưới dạng secret phía server khi đã quyết định thử có phí.
- `.openai/hosting.json` giữ tên binding để chạy/build cục bộ, không gắn ID dự án của chủ website.

Người tự host cần rà soát URL trong `lib/server/auth.ts`, cấu hình callback Supabase theo domain mới và kiểm tra cookie Secure trên HTTPS. Đăng nhập giả lập của starter Sites không thay thế xác thực Supabase của EcoSnap.

## Migration trên máy

Sau `pnpm build`, cấu hình Worker cục bộ được tạo tại `dist/server/wrangler.json`. Áp dụng tệp SQL trong `drizzle/` từ `0000` đến `0004`, mỗi migration đúng một lần, vào database cục bộ:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_hesitant_madame_masque.sql
```

Thay tên tệp bằng từng migration tiếp theo. Lệnh này chỉ dành cho database cục bộ. Migration không có tài khoản, lịch sử hay chi phí người dùng thật. Chúng giữ cấu trúc cũ phục vụ tương thích; luồng phân loại mới chủ yếu dùng quy tắc trong `lib/sorting-rules.ts` và `lib/manual-lookup.ts`.

## Nhận diện và hướng dẫn

Frontend nhận tối đa ba ảnh cho một tình huống, thu nhỏ và bỏ EXIF. Chỉ gửi sau khi người dùng đồng ý và chủ website mở cổng AI. Backend kiểm tra ảnh, bỏ metadata JPEG, gửi inline với `store:false`, không lưu ảnh nhận diện vào D1/R2 hay nhật ký. Chính sách nhà cung cấp vẫn áp dụng; `store:false` không phải cam kết Zero Data Retention.

Model được ghim trong `lib/server/ai-policy.ts`; output tối đa 512 token cho luồng cũ, 1.500 token cho đọc nhãn. Phản hồi phải qua schema chặt. AI nhận diện tên/nhãn/các phần; hướng dẫn và nguồn tham khảo do backend chọn từ nội dung đã kiểm duyệt. AI không tự tạo hướng dẫn hoặc địa chỉ thu gom.

Người dùng sửa và xác nhận nhãn trước khi xem kết quả. Mã nắp không tự gán cho thân; khác dung tích/phiên bản không tự dùng hồ sơ gần giống. Tham chiếu thương hiệu có thời hạn và phạm vi cụ thể trong `lib/server/product-guidance.ts`.

## Hạn mức và ngân sách

- Tối đa 5 lượt có kết quả/ngày, 20/tháng, theo `Asia/Ho_Chi_Minh`.
- Chưa xác định, lỗi kỹ thuật hoặc thiếu hướng dẫn không trừ lượt thành công; ba lần chưa xác định liên tiếp nghỉ 10 phút.
- Backend giữ chỗ nguyên tử, xử lý idempotency và yêu cầu đồng thời. Tra cứu thủ công/xem lại không gọi AI.
- Ngân sách ứng dụng tối đa 5.000.000 VND/tháng; cảnh báo 3.500.000 và 4.500.000 VND, tính cả yêu cầu đang xử lý.
- Dự phòng bảo thủ hiện tại là 12.643 VND/yêu cầu, bao phủ context và output đã cấu hình. Đây là dự toán, không phải phí cố định mỗi ảnh. Chi phí từ usage do backend ghi; khi thiếu usage giữ dự phòng thành ước tính cần đối soát.
- Giá/tỷ giá trong mã là cấu hình tại thời điểm viết. Trước khi tự bật AI phải đối chiếu giá và quyền model hiện hành. Giới hạn chỉ bao phủ adapter EcoSnap, không bao phủ ứng dụng khác dùng cùng khóa.

## Phạm vi kiểm chứng

88 kiểm thử dùng SQLite thật với dữ liệu thử, auth/R2 giả lập và adapter OpenAI có transport giả lập; mọi fetch ngoài fixture bị chặn. TypeScript và build phiên bản gốc đã đạt. Chưa dùng ảnh thật để đánh giá đọc nhãn phiên bản này. Không suy ra từ kiểm thử giả lập rằng dịch vụ đăng nhập, camera điện thoại, độ chính xác hay chi phí thực tế đã được kiểm chứng.
