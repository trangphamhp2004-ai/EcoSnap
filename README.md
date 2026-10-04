# EcoSnap

Website hỗ trợ phân loại rác sinh hoạt theo đồ vật và tình trạng thực tế. Luồng chính: **chọn đồ vật → trả lời câu hỏi → xem cách tách từng phần và phân nhóm rác**. Eco Tips cung cấp gợi ý tái sử dụng, tái chế bổ sung.

**Website:** https://ecosnap.trangphamhp2004.chatgpt.site/

Đây là bản mã nguồn để đọc, chấm và kiểm thử dự án, xuất từ phiên bản website 16, đồng bộ ngày 04/10/2026. Repo không chứa dữ liệu người dùng, ảnh người dùng, khóa API hay lịch sử triển khai nội bộ. Website được quản lý riêng trên Sites; thay đổi repo không tự triển khai lên website.

## Chức năng

- Tra cứu thủ công theo đồ vật, phần chứa bên trong, chất liệu và mức độ bẩn; không dùng AI hoặc trừ lượt.
- Phân loại từng phần vào nhóm tái sử dụng/tái chế, chất thải thực phẩm hoặc chất thải sinh hoạt còn lại. Trường hợp nguy hại hoặc chưa rõ có hướng dẫn riêng.
- Luồng AI mở rộng: tối đa ba ảnh cho một tình huống, đọc nhãn/thương hiệu/mã vật liệu, người dùng sửa và xác nhận rồi xem hướng dẫn có nguồn đã kiểm duyệt.
- Lưu và xem lại hướng dẫn; quản trị nội dung; gửi góp ý.
- Backend quản lý quyền sở hữu kết quả, hạn mức, ngân sách, yêu cầu trùng và yêu cầu đồng thời.

**AI được mở cho người dùng đã đăng nhập, có cấu hình dịch vụ và đồng ý gửi ảnh; hạn mức và ngân sách được kiểm soát ở backend.** Kiểm thử dưới đây dùng phản hồi OpenAI giả lập. Chưa xác minh độ chính xác đọc nhãn bằng ảnh thật cho bản cập nhật này. Kho tham chiếu thương hiệu có phạm vi giới hạn; thương hiệu chưa có hồ sơ phù hợp không được tự ghép sang sản phẩm khác.

Mục kiến thức bổ sung thư viện vật liệu, 60 địa điểm, 16 dự án và 11 bài viết có nguồn tham khảo.

## Công nghệ và cấu trúc

React 19, TypeScript, Vinext/Vite, Tailwind CSS, Cloudflare Workers/D1/R2, Drizzle và Supabase Auth. Phiên bản cụ thể được khóa trong `pnpm-lock.yaml`.

| Thư mục | Nội dung |
| --- | --- |
| `app/` | Trang, giao diện và API EcoSnap |
| `components/manual-lookup.tsx` | Luồng tra cứu thủ công |
| `components/scan-flow.tsx`, `components/product-label.tsx` | Chọn ảnh, đồng ý gửi ảnh và xác nhận nhãn |
| `lib/manual-lookup.ts`, `lib/sorting-rules.ts` | Câu hỏi và quy tắc phân loại |
| `lib/server/` | Xác thực, phân loại, adapter AI, hạn mức và chi phí |
| `db/`, `drizzle/` | Schema và migration; không chứa bản sao dữ liệu thật |
| `tests/` | Kiểm thử bằng dữ liệu và phản hồi giả lập |
| `build/`, `scripts/` | Hỗ trợ build và môi trường Sites |

## Chạy và kiểm thử trên máy

Yêu cầu Node.js **22.13 trở lên** và **pnpm 11.25.0** theo `packageManager`. Lệnh `install:ci` của starter dành cho môi trường Sites được quản lý; với bản clone thông thường dùng trực tiếp pnpm:

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit --incremental false
node tests/backend.mjs
pnpm build
pnpm dev
```

Bản clone chưa có tài khoản Supabase, dữ liệu D1 hay kho R2 thật. `pnpm dev` không tự tạo bản đầy đủ chức năng giống website. Đăng nhập cần cấu hình dịch vụ riêng; dữ liệu cục bộ cần migration. Xem [thiết lập backend](BACKEND_SETUP.md).

### Xem luồng bằng dữ liệu giả lập, không cần khóa API

Sau khi cài dependency, chạy trên macOS/Linux:

```sh
ECOSNAP_UI_TEST=1 node tests/backend.mjs
```

Với PowerShell:

```powershell
$env:ECOSNAP_UI_TEST = "1"
node tests/backend.mjs
```

Mở địa chỉ `http://127.0.0.1:.../` được in ra sau kiểm thử. Đây là giao diện kiểm thử cô lập với nhãn **KIỂM THỬ GIẢ LẬP**, không phải website đầy đủ và không gọi OpenAI. Dừng bằng Ctrl+C. Dữ liệu thử nằm trong `.backend-tests/` và được dọn khi kết thúc bình thường.

## Kết quả kiểm thử

Bản đồng bộ này đã đạt **106/106 kiểm thử backend**, bao gồm kiểm tra AI công khai và kho kiến thức. Bao gồm tra cứu thủ công, thành công/chưa xác định/thiếu hướng dẫn, API lỗi, thời gian chờ, hạn mức ngày/tháng theo giờ Việt Nam, ngân sách và dự phòng, gửi trùng/nhiều tab, nhiều ảnh, nhãn mờ, mã nắp/thân, sửa nhãn và xem dữ liệu cũ.

Auth, OpenAI và lưu trữ trong bộ kiểm thử là fixture riêng. Kết quả này không chứng minh chất lượng AI với ảnh thật hoặc xác nhận dịch vụ đăng nhập/cloud storage bên ngoài. Toàn bộ kiểm thử backend chặn mạng và không cần `OPENAI_API_KEY`.

## Dữ liệu và triển khai

- `.env.example` chỉ liệt kê tên biến với giá trị trống. Khóa thực tế đặt trên dịch vụ hosting, không lưu vào repo.
- `.openai/hosting.json` trong bản công khai chỉ giữ binding `DB`/`BUCKET`, đã bỏ liên kết project triển khai đang chạy.
- Không có database dump, ảnh người dùng, cookie, nhật ký dữ liệu thật hoặc quyền quản trị đi kèm mã nguồn.
- Các giấy phép thư viện trong `vendor/` và `build/` được giữ nguyên. Repo chưa cấp thêm giấy phép sử dụng cho phần mã riêng của EcoSnap.
