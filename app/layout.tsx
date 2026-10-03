import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'EcoSnap — Phân loại rác hằng ngày',description:'Tách từng phần, chọn đúng nhóm rác và xem cách chuẩn bị trước khi thu gom. Tra cứu thủ công không dùng AI.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:Readonly<{children:React.ReactNode}>){return <html lang="vi"><body>{children}</body></html>}
