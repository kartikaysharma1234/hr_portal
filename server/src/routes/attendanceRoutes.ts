import { Router } from 'express';

import {
  approvePunch,
  approveRegularization,
  bulkApprovePunches,
  createAttendanceSettings,
  createOfficeLocation,
  createLeaveRequest,
  createRegularization,
  deleteAttendanceSettings,
  deleteOfficeLocation,
  exportAttendanceReport,
  getAttendanceSettings,
  getMyAttendanceContext,
  getDailyAttendanceDetail,
  getDailyReport,
  getDepartmentWiseReport,
  getDistanceReport,
  getInvalidPunchReport,
  getLateTrendReport,
  getMonthlySummaryReport,
  getMyAttendance,
  getMyLeaveLedger,
  listLeaveLedgerEmployees,
  getPendingApprovals,
  getRealtimeAttendanceSnapshot,
  getSourceAnalysisReport,
  importAttendanceBiometric,
  importAttendanceCsv,
  listOfficeLocations,
  listLeaveRequests,
  listRegularizationRequests,
  punchIn,
  punchOut,
  cancelLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  rejectPunch,
  rejectRegularization,
  upsertLeaveLedger,
  updateAttendanceSettings,
  updateOfficeLocation
} from '../controllers/attendanceController';
import {
  approveAppreciationRequest,
  approveLeaveEncashmentRequest,
  approveResignationRequest,
  cancelAppreciationRequest,
  cancelHelpDeskRequest,
  cancelLeaveEncashmentRequest,
  cancelResignationRequest,
  createAppreciationRequest,
  createHelpDeskRequest,
  createLeaveEncashmentRequest,
  createResignationRequest,
  getLeaveEncashmentMeta,
  getRequestMasters,
  listAppreciationRequests,
  listHelpDeskRequests,
  listLeaveEncashmentRequests,
  listResignationRequests,
  rejectAppreciationRequest,
  rejectLeaveEncashmentRequest,
  rejectResignationRequest,
  respondHelpDeskRequest
} from '../controllers/requestController';
import { requireAuth } from '../middleware/authMiddleware';
import { resolveTenant } from '../middleware/tenantMiddleware';

const attendanceRouter = Router();

attendanceRouter.use(resolveTenant, requireAuth);

attendanceRouter.post('/punch-in', punchIn);
attendanceRouter.post('/punch-out', punchOut);
attendanceRouter.get('/my-context', getMyAttendanceContext);
attendanceRouter.get('/my-attendance', getMyAttendance);
attendanceRouter.get('/daily/:date', getDailyAttendanceDetail);
attendanceRouter.get('/leave-ledger', getMyLeaveLedger);
attendanceRouter.put('/leave-ledger', upsertLeaveLedger);
attendanceRouter.get('/leave-ledger/employees', listLeaveLedgerEmployees);
attendanceRouter.post('/leave-requests', createLeaveRequest);
attendanceRouter.get('/leave-requests', listLeaveRequests);
attendanceRouter.post('/leave-requests/cancel/:id', cancelLeaveRequest);
attendanceRouter.post('/leave-requests/approve/:id', approveLeaveRequest);
attendanceRouter.post('/leave-requests/reject/:id', rejectLeaveRequest);

attendanceRouter.get('/request-masters', getRequestMasters);

attendanceRouter.post('/helpdesk-requests', createHelpDeskRequest);
attendanceRouter.get('/helpdesk-requests', listHelpDeskRequests);
attendanceRouter.post('/helpdesk-requests/cancel/:id', cancelHelpDeskRequest);
attendanceRouter.post('/helpdesk-requests/respond/:id', respondHelpDeskRequest);

attendanceRouter.post('/appreciation-requests', createAppreciationRequest);
attendanceRouter.get('/appreciation-requests', listAppreciationRequests);
attendanceRouter.post('/appreciation-requests/cancel/:id', cancelAppreciationRequest);
attendanceRouter.post('/appreciation-requests/approve/:id', approveAppreciationRequest);
attendanceRouter.post('/appreciation-requests/reject/:id', rejectAppreciationRequest);

attendanceRouter.post('/resignation-requests', createResignationRequest);
attendanceRouter.get('/resignation-requests', listResignationRequests);
attendanceRouter.post('/resignation-requests/cancel/:id', cancelResignationRequest);
attendanceRouter.post('/resignation-requests/approve/:id', approveResignationRequest);
attendanceRouter.post('/resignation-requests/reject/:id', rejectResignationRequest);

attendanceRouter.get('/leave-encashment/meta', getLeaveEncashmentMeta);
attendanceRouter.post('/leave-encashment-requests', createLeaveEncashmentRequest);
attendanceRouter.get('/leave-encashment-requests', listLeaveEncashmentRequests);
attendanceRouter.post('/leave-encashment-requests/cancel/:id', cancelLeaveEncashmentRequest);
attendanceRouter.post('/leave-encashment-requests/approve/:id', approveLeaveEncashmentRequest);
attendanceRouter.post('/leave-encashment-requests/reject/:id', rejectLeaveEncashmentRequest);

attendanceRouter.get('/settings', getAttendanceSettings);
attendanceRouter.post('/settings', createAttendanceSettings);
attendanceRouter.put('/settings/:id', updateAttendanceSettings);
attendanceRouter.delete('/settings/:id', deleteAttendanceSettings);

attendanceRouter.get('/office-locations', listOfficeLocations);
attendanceRouter.post('/office-locations', createOfficeLocation);
attendanceRouter.put('/office-locations/:id', updateOfficeLocation);
attendanceRouter.delete('/office-locations/:id', deleteOfficeLocation);

attendanceRouter.get('/pending-approvals', getPendingApprovals);
attendanceRouter.post('/approve/bulk', bulkApprovePunches);
attendanceRouter.post('/approve/:punchId', approvePunch);
attendanceRouter.post('/reject/:punchId', rejectPunch);

attendanceRouter.post('/regularize', createRegularization);
attendanceRouter.get('/regularization-requests', listRegularizationRequests);
attendanceRouter.post('/regularization/approve/:id', approveRegularization);
attendanceRouter.post('/regularization/reject/:id', rejectRegularization);

attendanceRouter.get('/reports/daily', getDailyReport);
attendanceRouter.get('/reports/monthly', getMonthlySummaryReport);
attendanceRouter.get('/reports/invalid', getInvalidPunchReport);
attendanceRouter.get('/reports/department-wise', getDepartmentWiseReport);
attendanceRouter.get('/reports/late-trend', getLateTrendReport);
attendanceRouter.get('/reports/distance', getDistanceReport);
attendanceRouter.get('/reports/source-analysis', getSourceAnalysisReport);
attendanceRouter.get('/reports/export', exportAttendanceReport);

attendanceRouter.get('/monitoring/realtime', getRealtimeAttendanceSnapshot);

attendanceRouter.post('/import/csv', importAttendanceCsv);
attendanceRouter.post('/import/biometric', importAttendanceBiometric);

export { attendanceRouter };
