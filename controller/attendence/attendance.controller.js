// controller/attendance/attendance.controller.js
const { Op } = require("sequelize");
const Employee = require("../../models/employee/employee.model");
const Attendance = require("../../models/attendence/attendance.model");

// Helper function to calculate overtime (assuming 8 hours workday)
const calculateOvertime = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  
  const workStart = new Date(`1970-01-01T${checkIn}`);
  const workEnd = new Date(`1970-01-01T${checkOut}`);
  const workedHours = (workEnd - workStart) / (1000 * 60 * 60);
  const standardHours = 8;
  
  return workedHours > standardHours ? workedHours - standardHours : 0;
};

//! Mark attendance (for admin - bulk)
const markAttendance = async (req, res, next) => {
  try {
    const { date, attendance: attendanceList } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role || "admin";

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required!",
      });
    }

    if (!attendanceList || !Array.isArray(attendanceList) || attendanceList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Attendance list is required!",
      });
    }

    const results = {
      successful: [],
      failed: [],
    };

    for (const item of attendanceList) {
      try {
        const { employeeId, status, checkIn, checkOut, note } = item;

        if (!employeeId || !status) {
          results.failed.push({
            employeeId,
            reason: "Employee ID and status are required",
          });
          continue;
        }

        // Check if employee exists
        const employee = await Employee.findByPk(employeeId);
        if (!employee) {
          results.failed.push({
            employeeId,
            reason: "Employee not found",
          });
          continue;
        }

        // Calculate overtime if checkIn and checkOut provided
        let overtime = 0;
        if (checkIn && checkOut && status === "present") {
          overtime = calculateOvertime(checkIn, checkOut);
        }

        // Upsert attendance (create or update)
        const [attendance, created] = await Attendance.upsert({
          employeeId,
          date,
          status,
          checkIn: checkIn || null,
          checkOut: checkOut || null,
          checkInNote: note || null,
          checkOutNote: note || null,
          markedBy: userId,
          markedByRole: userRole,
          overtime,
        });

        results.successful.push({
          employeeId,
          name: employee.name,
          status,
          created: created ? "created" : "updated",
        });
      } catch (error) {
        results.failed.push({
          employeeId: item.employeeId,
          reason: error.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: `${results.successful.length} attendance records processed, ${results.failed.length} failed`,
      data: results,
    });
  } catch (error) {
    console.error("Error marking attendance:", error);
    next(error);
  }
};

//! Employee self check-in
const selfCheckIn = async (req, res, next) => {
  try {
    const { note, location, deviceInfo, ipAddress } = req.body;
    const employeeId = req.user?.employeeId || req.user?.id;
    const userId = req.user?.id;
    const today = new Date().toISOString().split("T")[0];
    const currentTime = new Date().toLocaleTimeString("en-US", { hour12: false });

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee information not found!",
      });
    }

    // Check if employee exists
    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found!",
      });
    }

    // Check if attendance already exists for today
    let attendance = await Attendance.findOne({
      where: {
        employeeId,
        date: today,
      },
    });

    if (attendance) {
      // Check if already checked in
      if (attendance.checkIn) {
        return res.status(400).json({
          success: false,
          message: "You have already checked in today!",
          data: attendance,
        });
      }

      // Update existing record with check-in
      await attendance.update({
        checkIn: currentTime,
        checkInNote: note || null,
        location: location || null,
        ipAddress: ipAddress || null,
        deviceInfo: deviceInfo || null,
        status: "present",
        markedBy: userId,
        markedByRole: "employee",
      });
    } else {
      // Create new attendance record
      attendance = await Attendance.create({
        employeeId,
        date: today,
        status: "present",
        checkIn: currentTime,
        checkInNote: note || null,
        location: location || null,
        ipAddress: ipAddress || null,
        deviceInfo: deviceInfo || null,
        markedBy: userId,
        markedByRole: "employee",
      });
    }

    // Fetch updated attendance with employee info separately
    const updatedAttendance = await Attendance.findByPk(attendance.id);
    
    return res.status(200).json({
      success: true,
      message: "Check-in successful!",
      data: {
        ...updatedAttendance.toJSON(),
        employee: {
          id: employee.id,
          name: employee.name,
          employeeId: employee.employeeId,
          designation: employee.designation,
          department: employee.department,
          shift: employee.shift,
        },
      },
    });
  } catch (error) {
    console.error("Error during check-in:", error);
    next(error);
  }
};

//! Employee self check-out
const selfCheckOut = async (req, res, next) => {
  try {
    const { note, location, deviceInfo, ipAddress } = req.body;
    const employeeId = req.user?.employeeId || req.user?.id;
    const userId = req.user?.id;
    const today = new Date().toISOString().split("T")[0];
    const currentTime = new Date().toLocaleTimeString("en-US", { hour12: false });

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee information not found!",
      });
    }

    // Check if employee exists
    const employee = await Employee.findByPk(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found!",
      });
    }

    // Find today's attendance
    const attendance = await Attendance.findOne({
      where: {
        employeeId,
        date: today,
      },
    });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No check-in record found for today. Please check-in first!",
      });
    }

    if (!attendance.checkIn) {
      return res.status(400).json({
        success: false,
        message: "You haven't checked in today. Please check-in first!",
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        success: false,
        message: "You have already checked out today!",
        data: attendance,
      });
    }

    // Calculate overtime
    const overtime = calculateOvertime(attendance.checkIn, currentTime);

    // Update with check-out
    await attendance.update({
      checkOut: currentTime,
      checkOutNote: note || null,
      location: location || null,
      ipAddress: ipAddress || null,
      deviceInfo: deviceInfo || null,
      overtime,
      markedBy: userId,
      markedByRole: "employee",
    });

    // Fetch updated attendance
    const updatedAttendance = await Attendance.findByPk(attendance.id);

    return res.status(200).json({
      success: true,
      message: "Check-out successful!",
      data: {
        ...updatedAttendance.toJSON(),
        employee: {
          id: employee.id,
          name: employee.name,
          employeeId: employee.employeeId,
          designation: employee.designation,
          department: employee.department,
          shift: employee.shift,
        },
      },
    });
  } catch (error) {
    console.error("Error during check-out:", error);
    next(error);
  }
};

//! Get today's attendance status for logged-in employee
const getMyTodayAttendance = async (req, res, next) => {
  try {
    const employeeId = req.user?.employeeId || req.user?.id;
    const today = new Date().toISOString().split("T")[0];

    const attendance = await Attendance.findOne({
      where: {
        employeeId,
        date: today,
      },
    });

    const employee = await Employee.findByPk(employeeId, {
      attributes: ["id", "name", "employeeId", "designation", "department", "shift"],
    });

    return res.status(200).json({
      success: true,
      message: "Today's attendance retrieved successfully!",
      data: {
        attendance: attendance || null,
        employee: employee,
        hasCheckedIn: attendance?.checkIn ? true : false,
        hasCheckedOut: attendance?.checkOut ? true : false,
      },
    });
  } catch (error) {
    console.error("Error getting today's attendance:", error);
    next(error);
  }
};

//! Get attendance by date range (for admin)
const getAttendanceByDateRange = async (req, res, next) => {
  try {
    const { startDate, endDate, employeeId, status, department, shift } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and end date are required!",
      });
    }

    const whereClause = {
      date: {
        [Op.between]: [startDate, endDate],
      },
    };

    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    if (status) {
      whereClause.status = status;
    }

    // Get attendance records
    const { count, rows: attendanceRecords } = await Attendance.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [["date", "DESC"]],
    });

    // Get all unique employee IDs from attendance records
    const employeeIds = [...new Set(attendanceRecords.map(record => record.employeeId))];
    
    // Fetch employee details separately
    const employees = await Employee.findAll({
      where: {
        id: employeeIds,
        ...(department && { department }),
        ...(shift && { shift }),
      },
      attributes: ["id", "name", "employeeId", "designation", "department", "shift", "profileImage"],
    });

    // Combine attendance with employee details
    const employeeMap = new Map(employees.map(emp => [emp.id, emp]));
    const formattedAttendance = attendanceRecords.map(record => ({
      ...record.toJSON(),
      employee: employeeMap.get(record.employeeId) || null,
    }));

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      success: true,
      message: "Attendance records retrieved successfully!",
      data: formattedAttendance,
      pagination: {
        totalItems: count,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Error getting attendance by date range:", error);
    next(error);
  }
};

//! Get employee attendance summary
const getEmployeeAttendanceSummary = async (req, res, next) => {
  try {
    const { employeeId, year, month } = req.query;
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required!",
      });
    }

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${new Date(targetYear, targetMonth, 0).getDate()}`;

    const attendance = await Attendance.findAll({
      where: {
        employeeId,
        date: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    const summary = {
      totalDays: attendance.length,
      present: attendance.filter(a => a.status === "present").length,
      absent: attendance.filter(a => a.status === "absent").length,
      late: attendance.filter(a => a.status === "late").length,
      halfDay: attendance.filter(a => a.status === "half-day").length,
      totalOvertime: attendance.reduce((sum, a) => sum + (a.overtime || 0), 0),
      attendanceRate: 0,
    };

    const totalWorkingDays = new Date(targetYear, targetMonth, 0).getDate();
    summary.attendanceRate = totalWorkingDays > 0 ? (summary.present / totalWorkingDays) * 100 : 0;

    return res.status(200).json({
      success: true,
      message: "Attendance summary retrieved successfully!",
      data: {
        employeeId,
        year: targetYear,
        month: targetMonth,
        ...summary,
      },
    });
  } catch (error) {
    console.error("Error getting employee attendance summary:", error);
    next(error);
  }
};

//! Get daily attendance report (for admin dashboard)
const getDailyAttendanceReport = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split("T")[0];

    const totalEmployees = await Employee.count({
      where: { status: "active" },
    });

    const attendanceRecords = await Attendance.findAll({
      where: { date: targetDate },
    });

    // Get all employee IDs from attendance
    const employeeIds = attendanceRecords.map(record => record.employeeId);
    
    // Fetch all active employees
    const allEmployees = await Employee.findAll({
      where: { status: "active" },
      attributes: ["id", "name", "employeeId", "designation", "department", "shift"],
    });

    // Create map of attendance records by employee ID
    const attendanceMap = new Map(attendanceRecords.map(record => [record.employeeId, record]));

    // Combine attendance with employee details
    const recordsWithEmployees = allEmployees.map(employee => ({
      ...(attendanceMap.get(employee.id)?.toJSON() || {
        employeeId: employee.id,
        date: targetDate,
        status: "absent",
        checkIn: null,
        checkOut: null,
      }),
      employee: {
        id: employee.id,
        name: employee.name,
        employeeId: employee.employeeId,
        designation: employee.designation,
        department: employee.department,
        shift: employee.shift,
      },
    }));

    const present = recordsWithEmployees.filter(a => a.status === "present").length;
    const late = recordsWithEmployees.filter(a => a.status === "late").length;
    const halfDay = recordsWithEmployees.filter(a => a.status === "half-day").length;
    const absent = recordsWithEmployees.filter(a => a.status === "absent").length;

    return res.status(200).json({
      success: true,
      message: "Daily attendance report retrieved successfully!",
      data: {
        date: targetDate,
        totalEmployees,
        present,
        absent,
        late,
        halfDay,
        attendanceRate: totalEmployees > 0 ? ((present + late + halfDay) / totalEmployees) * 100 : 0,
        records: recordsWithEmployees,
      },
    });
  } catch (error) {
    console.error("Error getting daily attendance report:", error);
    next(error);
  }
};

//! Get monthly attendance report (for admin)
const getMonthlyAttendanceReport = async (req, res, next) => {
  try {
    const { year, month, department } = req.query;
    const targetYear = year || new Date().getFullYear();
    const targetMonth = month || new Date().getMonth() + 1;

    const startDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
    const endDate = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${new Date(targetYear, targetMonth, 0).getDate()}`;

    const employeeWhereClause = { status: "active" };
    if (department) {
      employeeWhereClause.department = department;
    }

    const employees = await Employee.findAll({
      where: employeeWhereClause,
      attributes: ["id", "name", "employeeId", "designation", "department", "shift"],
    });

    const attendanceRecords = await Attendance.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate],
        },
      },
    });

    const report = employees.map(employee => {
      const employeeAttendance = attendanceRecords.filter(a => a.employeeId === employee.id);
      
      return {
        employee: {
          id: employee.id,
          name: employee.name,
          employeeId: employee.employeeId,
          designation: employee.designation,
          department: employee.department,
          shift: employee.shift,
        },
        summary: {
          totalDays: employeeAttendance.length,
          present: employeeAttendance.filter(a => a.status === "present").length,
          absent: employeeAttendance.filter(a => a.status === "absent").length,
          late: employeeAttendance.filter(a => a.status === "late").length,
          halfDay: employeeAttendance.filter(a => a.status === "half-day").length,
          totalOvertime: employeeAttendance.reduce((sum, a) => sum + (a.overtime || 0), 0),
        },
      };
    });

    return res.status(200).json({
      success: true,
      message: "Monthly attendance report retrieved successfully!",
      data: {
        year: targetYear,
        month: targetMonth,
        report,
      },
    });
  } catch (error) {
    console.error("Error getting monthly attendance report:", error);
    next(error);
  }
};

//! Update attendance record (for admin)
const updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, checkIn, checkOut, note } = req.body;
    const userId = req.user?.id;

    const attendance = await Attendance.findByPk(id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found!",
      });
    }

    let overtime = attendance.overtime;
    if (checkIn && checkOut && status === "present") {
      overtime = calculateOvertime(checkIn, checkOut);
    }

    await attendance.update({
      status: status || attendance.status,
      checkIn: checkIn || attendance.checkIn,
      checkOut: checkOut || attendance.checkOut,
      checkInNote: note || attendance.checkInNote,
      checkOutNote: note || attendance.checkOutNote,
      overtime,
      markedBy: userId,
      markedByRole: "admin",
    });

    // Fetch updated attendance with employee info
    const updatedAttendance = await Attendance.findByPk(id);
    const employee = await Employee.findByPk(updatedAttendance.employeeId, {
      attributes: ["id", "name", "employeeId", "designation", "department", "shift"],
    });

    return res.status(200).json({
      success: true,
      message: "Attendance record updated successfully!",
      data: {
        ...updatedAttendance.toJSON(),
        employee,
      },
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    next(error);
  }
};

module.exports = {
  markAttendance,
  selfCheckIn,
  selfCheckOut,
  getMyTodayAttendance,
  getAttendanceByDateRange,
  getEmployeeAttendanceSummary,
  getDailyAttendanceReport,
  getMonthlyAttendanceReport,
  updateAttendance,
};