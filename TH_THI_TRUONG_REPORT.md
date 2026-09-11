# Form TH thị trường

Vào Tiêu dùng di động → Báo cáo → TH thị trường, chọn tháng/năm. Báo cáo hiển thị chỉ tiêu theo hàng, 9 thị trường theo cột, VTG cơ cấu gốc và VTT tham chiếu Việt Nam. KPI là số tại kỳ, không cộng dồn số thuê bao, ARPU hoặc tỷ lệ.

## Nhập liệu
Nhập / sửa KPI tháng cung cấp 18 chỉ tiêu đầu vào, đơn vị rõ ràng và mốc tham chiếu cho trạm, dân số, thị phần, giá thành. Các chỉ tiêu còn lại tính theo công thức mẫu. Ô trống giữ là thiếu; số 0 được bảo toàn; mẫu số 0 không cho kết quả giả. Lưu theo MarketCode/Year/Month trong bảng mới 34_MARKET_KPI. Kiểm tra revision, đọc lại Sheet sau ghi, ghi audit MARKET_KPI và rollback nếu đọc lại/audit lỗi. Không sửa schema hoặc dữ liệu tiêu dùng cũ. KPI bổ sung ở trạng thái nháp; chưa có quy trình chốt KPI riêng.

## Nguồn
File TD thuc.xlsx, TH thi truong A1=7 B1=2026. Đọc số cache liên kết ngoài, không cập nhật liên kết. Trạm/dân số/giá thành tham chiếu 2025; thị phần 03/2026. Giữ cả số 0 và DOU bất thường để người dùng rà soát. MOU hai chiều = MOU đi × 2 theo công thức mẫu. Lợi nhuận % = giá bán/giá thành − 1, không phải biên lợi nhuận trên doanh thu.

Theo sheet mẫu ưu tiên cơ cấu gốc đã lưu (T7/2026 và T12/2018–2025). Theo dữ liệu tiêu dùng tính lại từ số đang quản lý. Một số tỷ lệ lịch sử khác nhau giữa hai sheet; không ghi đè dữ liệu tiêu dùng để ép khớp báo cáo. Nguồn này cũng áp dụng cho tỷ lệ tiêu dùng Data và ARPU Data. Cơ cấu thiếu snapshot sẽ dùng dữ liệu tiêu dùng. VTT chỉ có dữ liệu tham chiếu ở những kỳ/cột nguồn có số. Không sử dụng các bảng phụ cạnh phải, khối phụ 41–48 và ô #REF! làm dữ liệu vận hành.

## Files changed
- MarketKpiService.gs: lưu/readback/revision/audit và validation.
- MarketReportJS.html: ma trận, công thức, form KPI, lựa chọn cơ cấu, nhập JSON và CSV.
- ConsumptionJS.html, AppJS.html, Index.html: tích hợp điều hướng và sự kiện.
- Styles.html: cuộn ngang/dọc, cố định tiêu đề và tên chỉ tiêu.
- tools/extract_market_kpi.py, tools/verify_market_kpi.py: đọc nguồn và kiểm chứng Sheet.
- tests/market-report.test.cjs: kiểm thử nghiệp vụ.

## Checklist
- [x] 115 checks trên 10 file test: tất cả đạt.
- [x] Lưu, revision, dòng trống vật lý, rollback khi audit lỗi.
- [x] Công thức đơn vị, số 0/thiếu và mẫu số 0.
- [x] Chọn nguồn cơ cấu gốc/tính lại.
- [x] Deploy Apps Script v20 vào deployment hiện tại.
- [x] Xác minh 94 record KPI/cơ cấu, 553 giá trị và 105 audit trên Sheet thật, không sai lệch.
- [x] Lưu lại VTC bằng form KPI, đọc lại và kiểm chứng audit.
- [x] 270 ô KPI tính toán khớp sheet mẫu cho 9 thị trường.
- [x] 1.528 kỳ thị trường và 188 kỳ VTG vẫn nguyên vẹn sau bổ sung KPI.

Dữ liệu nhập riêng tư không nằm trong Git/source ZIP.
