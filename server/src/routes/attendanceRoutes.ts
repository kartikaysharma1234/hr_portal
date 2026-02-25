import { Router } from 'express';

import {
  approvePunch,
  approveRegularization,
  bulkApprovePunches,
  createAttendanceSettings,
  createOfficeLocation,
  createRegularization,
  deleteAttendanceSettings,
  deleteOfficeLocation,
  exportAttendanceReport,
  getAttendanceSettings,
  getDailyAttendanceDetail,
  getDailyReport,
  getDepartmentWiseReport,
  getDistanceReport,
  getInvalidPunchReport,
  getLateTrendReport,
  getMonthlySummaryReport,
  getMyAttendance,
  getPendingApprovals,
  getRealtimeAttendanceSnapshot,
  getSourceAnalysisReport,
  importAttendanceBiometric,
  importAttendanceCsv,
  listOfficeLocations,
  listRegularizationRequests,
  punchIn,
  punchOut,
  rejectPunch,
  rejectRegularization,
  updateAttendanceSettings,
  updateOfficeLocation
} from '../controllers/attendanceController';
import { requireAuth } from '../middleware/authMiddleware';
import { resolveTenant } from '../middleware/tenantMiddleware';

const attendanceRouter = Router();

attendanceRouter.use(resolveTenant, requireAuth);

attendanceRouter.post('/punch-in', punchIn);
attendanceRouter.post('/punch-out', punchOut);
attendanceRouter.get('/my-attendance', getMyAttendance);
attendanceRouter.get('/daily/:date', getDailyAttendanceDetail);

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
