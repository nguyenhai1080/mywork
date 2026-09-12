# Upload KPI tháng từ file gốc

## Sử dụng
Mở Tiêu dùng di động hoặc Báo cáo VAS → Upload KPI tháng → chọn XLSB/XLSX → Kiểm tra file → Nhập kỳ mới.
Kỳ được đọc từ TH thi truong!A1:B1 và đối chiếu với tên file dạng YYYY.MM nếu có. Hai sheet bắt buộc: TD thuc và TH thi truong.

## Quy tắc
- Mặc định chỉ trích xuất kỳ ghi trên file; không nhập hoặc ghi đè các kỳ cũ. Không lấy tháng tương lai, số kế hoạch, tổng năm hoặc khối VTCM.
- Có tùy chọn đối chiếu các tháng cũ trong cùng năm từ TD thuc. Các chỉ tiêu khác chỉ hiển thị cảnh báo; không cập nhật. TH thi truong là snapshot kỳ hiện tại, không suy ra KPI các tháng cũ.
- Chỉ nhập kỳ mới hơn kỳ thực hiện mới nhất của từng bảng. Không tự lấp các kỳ lịch sử bị thiếu. Upload lại là no-op.
- Các placeholder nháp toàn 0 của bản TD thuc.xlsx tháng 8–12/2026, Revision 1 được coi là chưa nhập. Khi kỳ mới đến, có thể thay placeholder; không thay số thực tế kỳ cũ.
- Nhập 10 bản ghi tiêu dùng (VTG + 9 thị trường) và 11 bản ghi KPI/cơ cấu gồm VTT theo schema hiện tại. VBD quy về VTB; VTCM bị loại.
- TD thuc ghi vào 32_MOBILE_CONSUMPTION và 33_VTG_CONSUMPTION; TH thi truong ghi vào 34_MARKET_KPI. Không sửa schema.
- Giữ Tổng gốc, số 0 thực tế, đơn vị nghìn USD và cờ cơ cấu chưa khớp. KPI lưu các chỉ tiêu đầu vào đang quản lý, báo cáo tính các chỉ tiêu dẫn xuất.
- Kiểm tra cấu trúc, số, kỳ và khóa ghi lại trước save; ghi audit và đọc lại sau save. Lỗi bất kỳ bảng nào sẽ hoàn tác cả lô.
- Khi mẫu Excel đổi vị trí/nhãn chỉ tiêu hoặc thiếu cached values, dừng nhập và báo vị trí lỗi, không đoán dữ liệu.

## XLSB
Bộ đọc SheetJS CE 0.20.3 được đóng gói trong ứng dụng (SheetJsVendor.html, giấy phép SheetJS-LICENSE.txt). File đọc trên trình duyệt; chỉ gửi record trích xuất đến Apps Script. Không thực thi macro hoặc làm mới liên kết ngoài; dùng số được lưu lần cuối trong Excel. Giới hạn upload 50 MB.
Tài liệu bộ đọc: https://docs.sheetjs.com/docs/api/parse-options/

## Kiểm tra
- File gốc 2026.07. VTG KPIs di dong_TG2023..xlsb: xác định tháng 7/2026, đọc được 10 bản ghi TD và 11 KPI.
- 50 giá trị TD kỳ 7/2026 khớp dữ liệu nguồn đã nhập trước đây.
- 9 kiểm thử backend đạt: xem trước không ghi; nhập đồng bộ; nhập lại; chênh lệch cũ; không lấp kỳ cũ; lỗi validation; rollback lỗi audit; thay placeholder kỳ mới; replay sau save.
- Hồi quy các module hiện tại đạt sau cập nhật kiểm thử nút upload.
- Giao diện mở upload đã kiểm tra trên Web App v29. Công cụ browser chưa chọn được file trong iframe Apps Script: chưa xác minh upload đầu-cuối trên trình duyệt thật. Không phát sinh ghi dữ liệu production trong lượt kiểm tra này.

## Files changed
AppJS.html, Index.html; thêm MonthlyImportParser.html, MonthlyImportJS.html, MonthlyImportService.gs, SheetJsVendor.html, SheetJS-LICENSE.txt; tests/monthly-import.test.cjs; cập nhật tests/pr06-consumption-ui.test.cjs.
