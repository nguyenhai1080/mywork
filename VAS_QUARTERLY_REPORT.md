# Báo cáo VAS theo quý

Đã triển khai Web App với menu riêng **Báo cáo VAS** trên thanh điều hướng chính. Trên màn hình hẹp, bấm ☰ để mở menu.

## Phạm vi
- VTG dùng số gốc riêng; bảng gồm tất cả thị trường, bỏ VTCM và mã thử nghiệm.
- Đơn vị nghìn USD; doanh thu lấy từ VAS của số thực hiện.
- Chọn quý và năm kết thúc; biểu đồ Q1–Q4 so sánh năm chọn và hai năm trước, kèm bảng QoQ. Có lọc biểu đồ từng đơn vị và xuất CSV đủ 12 quý.

## Công thức
- Doanh thu quý = tổng VAS của ba tháng. TDG quý = tổng Total gốc của ba tháng.
- Tỷ trọng = VAS quý / TDG quý × 100, không bình quân tỷ trọng tháng.
- QoQ = (VAS quý / VAS quý trước − 1) × 100; Q1 so với Q4 năm trước.
- Cảnh báo khi QoQ nhà mạng >= 2 × QoQ VTG, chỉ xét khi QoQ VTG > 0. VTG không tăng trưởng dương được ghi rõ, không áp dụng phép so sánh gấp đôi.
- Thiếu tháng hoặc mẫu số không dương: không tính QoQ. Không thay dữ liệu thiếu bằng 0. Số 0 có trong nguồn được giữ nguyên, kể cả kỳ tương lai.
- Hiển thị tình trạng nháp, đủ tháng và cơ cấu chưa khớp; không thay Tổng gốc. Không sửa schema hoặc dữ liệu Sheet.

## Files changed
- VasReportJS.html: tính toán, bảng, biểu đồ và CSV.
- ConsumptionJS.html: lựa chọn báo cáo và thao tác xuất.
- AppJS.html: xử lý thay đổi quý và đơn vị biểu đồ.
- Index.html: nạp báo cáo.
- Styles.html: bố cục biểu đồ và màu cảnh báo.
- tests/vas-report.test.cjs: 10 kiểm tra nghiệp vụ.
- VAS_QUARTERLY_REPORT.md: hướng dẫn và kết quả nghiệm thu.

## Test checklist
- [x] Tổng quý, tỷ trọng theo tổng, QoQ và chuyển năm Q1/Q4.
- [x] Thiếu tháng, mẫu số 0, VTG tăng trưởng không dương.
- [x] Cảnh báo tại đúng ngưỡng 2 lần.
- [x] Danh sách thị trường, không cộng số tổng năm vào quý.
- [x] Toàn bộ 11 tệp kiểm thử: 125 kiểm tra đạt.
- [x] Mở lại Web App v21 và đối chiếu Q2/2026 với số nguồn độc lập. VTG: VAS 49,423.22; QoQ 11.04978%. MYN: VAS 17,771.01; QoQ 23.52001%, có cảnh báo. VTZ 21.31405%, không cảnh báo. DOM thiếu dữ liệu.
- [x] Biểu đồ 2024–2026 và lọc riêng MYN hoạt động; đã kiểm tra trực quan.
- [ ] Tải CSV trên trình duyệt chưa kiểm tra trực tiếp.
