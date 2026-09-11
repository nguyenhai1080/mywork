# Báo cáo VAS: Tháng / Quý / Năm

Mở menu **Báo cáo VAS**, chọn một trong ba tab. Chọn năm và tháng/quý tương ứng.

- Mọi tab có doanh thu VAS, TDG gốc, tỷ trọng VAS/TDG, doanh thu cùng kỳ năm trước, tăng trưởng YoY và cảnh báo.
- Tháng so cùng tháng năm trước; quý so cùng quý; năm so cả năm trước. Quý giữ thêm QoQ.
- Cảnh báo khi YoY âm, kể cả VTG; hoặc YoY nhà mạng >= 2 × YoY VTG với VTG > 0. Thiếu YoY VTG hoặc VTG không tăng trưởng dương: không xét gấp đôi.
- Chỉ tiêu thiếu tháng không được coi là 0. Số 0 gốc giữ nguyên. Tổng năm lịch sử dùng khi không có bản ghi tháng nào; không cộng đồng thời số năm và số tháng.
- Đơn vị nghìn USD. Biểu đồ so sánh ba năm và xuất CSV theo loại kỳ đang chọn.
- VTG lấy số gốc riêng; có toàn bộ thị trường, bỏ VTCM và mã thử nghiệm.

## Files changed
AppJS.html, Styles.html, VasReportJS.html, tests/vas-report.test.cjs, VAS_QUARTERLY_REPORT.md.

## Kiểm thử
17 kiểm thử VAS: tổng và tỷ trọng, QoQ chuyển năm, YoY tháng/quý, cả năm đủ/thiếu tháng, số tổng năm gốc, cảnh báo âm, ngưỡng gấp hai, VTG không tăng trưởng dương, số thiếu và mẫu số 0.

Đã kiểm tra trực tiếp ba tab trên Web App. T6/2026: VTG YoY 30.0%, MOV 73.0% và VTC 80.4% cảnh báo gấp hai; VTZ -74.7% cảnh báo âm. Toàn bộ 11 tệp kiểm thử đạt.

## Sửa kỳ chưa đủ dữ liệu
Các bản ghi ACTUAL/DRAFT chưa chỉnh sửa (Revision 1), nguồn TD thuc.xlsx | TD thuc!, tháng 8–12/2026, toàn bộ Total/Voice/SMS/Data/VAS bằng 0 được nhận diện là placeholder của bản nguồn đến tháng 7. Chỉ loại khỏi tính báo cáo VAS, không sửa Sheet. Bản ghi chỉnh sửa (Revision > 1), đã chốt, nguồn khác hoặc số 0 lịch sử giữ nguyên. Quý/năm chưa đủ tháng không có doanh thu cả kỳ, YoY/QoQ hay cảnh báo. Bộ lọc ghi rõ cơ sở YoY. 23 kiểm thử VAS đạt.

Theo yêu cầu làm rõ: báo cáo quý so cùng quý năm trước (Q3/2026 với Q3/2025); cảnh báo cũng dùng tỷ lệ này. Bỏ cột QoQ quý liền trước trên bảng để tránh nhầm.
