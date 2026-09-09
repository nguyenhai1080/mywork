# MyWork PR03 H01 — Task Metadata Date Fix

Migration: NONE. Schema giữ nguyên.
Baseline: toàn bộ source tại D:/Projects/MYWORK, sao chép ngày 2026-09-08. Không sửa checkout gốc.

## Files changed
- TaskService.gs: normalize assignedDate/dueDate thành AssignedDate/DueDate; từ chối ngày rỗng/sai; validate DueDate >= AssignedDate với giá trị hiện tại khi chỉ sửa một field. Giữ hành vi PR03 đồng bộ StartDate từ AssignedDate.
- TaskRepository.gs: dùng header thực; kiểm tra toàn bộ patch trước ghi; throw khi thiếu/trùng header; chỉ ghi cell được patch; flush và đọc lại, đối chiếu giá trị để phát hiện no-op. Giữ cơ chế rollback của service.
- TaskApi.gs: trả success, task đã được repository đọc lại trong lock, operationId; kiểm tra TaskID trước trả response.
- AuditService.gs: AssignedDate/DueDate so sánh và ghi dạng YYYY-MM-DD, tránh audit giả do khác giờ trong cùng ngày. Audit dùng record đã đọc lại.
- AppJS.html: nhận response.task sau save để cập nhật detail state; giữ refresh danh sách/detail hiện có.
- .claspignore: loại thư mục tests khỏi source deploy.

## Files added
- CHANGELOG_H01.md (tài liệu này)
- tests/h01.test.cjs
- tests/RESULTS_H01.txt

## Kiểm tra đã chạy
13 kiểm tra PASS bằng mock SpreadsheetApp; syntax toàn bộ GS và AppJS PASS.
Chạy lại: node tests/h01.test.cjs
Chưa chạy trên Google Apps Script/Google Sheet thật. Không deploy hoặc merge develop trong tác vụ này.

## Test checklist trên DEV
- [ ] Đổi AssignedDate 03/09/2026 -> 05/09/2026 và DueDate 15/09/2026 -> 20/09/2026. Save hiển thị hai ngày mới.
- [ ] Mở 10_TASKS: hai ô thực sự đổi; reload Web App vẫn giữ 05/09 và 20/09.
- [ ] 90_AUDIT_LOG có AssignedDate và DueDate với OldValue/NewValue đúng, cùng OperationID. Có thể có thêm StartDate theo hành vi PR03.
- [ ] Chỉ đổi DueDate; chỉ đổi AssignedDate: validate so với ngày còn lại đang lưu.
- [ ] DueDate < AssignedDate bị từ chối, không đổi task/audit; hai ngày bằng nhau được chấp nhận.
- [ ] Ngày rỗng, 2026-02-30, định dạng sai bị từ chối.
- [ ] Trên bản Sheet test riêng: đổi vị trí cột vẫn lưu đúng; header thiếu/sai phải báo lỗi, không success giả.
- [ ] Save lại cùng ngày không tạo thêm audit cho hai field ngày.
- [ ] My Work/Tasks cập nhật phân nhóm overdue/today/upcoming sau đổi DueDate; refresh giữ đúng.
- [ ] Tạo task, Update Result, Complete/Reopen vẫn hoạt động (repository dùng chung).
- [ ] Kiểm tra ngày theo timezone Apps Script hiện có, đặc biệt gần nửa đêm.

## Áp dụng
Giải nén ra thư mục riêng và đối chiếu source. Giữ cấu hình .clasp.json của môi trường đích; bản ZIP chứa cấu hình baseline hiện có. Push lên DEV và cập nhật deployment đang dùng nếu URL /exec chạy version cố định. Không cần chạy setup/migration. Chỉ merge PR03 khi checklist DEV pass.

## Giới hạn và ghi chú
Baseline đã có camelCase mapping; chưa có bằng chứng runtime để kết luận chính xác nguyên nhân bản đang deploy. H01 loại bỏ silent-ignore và kiểm chứng read-back; kiểm tra đúng deployment/version khi nghiệm thu.
Rollback dùng cơ chế PR03 hiện có; Google Sheets không cung cấp transaction nguyên tử giữa task và audit.

## H01 bổ sung — sửa nguyên nhân UI
submitEditTask_ khóa input trước khi gọi FormData, khiến payload rỗng. Đã lấy payload trước setModalBusy_. Service từ chối patch rỗng. 14 test backend/syntax và 1 test UI mock PASS; test UI tái hiện payload rỗng ở code cũ và xác nhận hai ngày ở code mới.

2026-09-09: sửa trên source v7; bỏ hai khai báo trùng apiUpdateTaskMetadata/updateTaskMetadata_ chứa debug placeholder; giữ Debug.gs riêng. Sửa lấy payload trước khóa form, chặn patch rỗng. 14 backend/syntax + 1 UI mock PASS.
