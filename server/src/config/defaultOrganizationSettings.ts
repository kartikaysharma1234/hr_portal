export type OrganizationSettings = Record<string, unknown>;

export const getDefaultOrganizationSettings = (): OrganizationSettings => {
  return {
    company: {
      basicInformation: {
        companyName: '',
        legalName: '',
        companyCode: '',
        registrationNumber: '',
        taxId: '',
        gstNumber: '',
        tanNumber: '',
        logoDataUrl: '',
        faviconDataUrl: '',
        tagline: '',
        industryType: '',
        companySize: 0,
        yearOfEstablishment: 0,
        websiteUrl: '',
        linkedInUrl: '',
        facebookUrl: '',
        twitterUrl: '',
        instagramUrl: ''
      },
      contactInformation: {
        headquartersAddress: '',
        branchAddresses: [],
        officialPhoneNumber: '',
        alternatePhoneNumber: '',
        officialEmail: '',
        supportEmail: '',
        hrEmail: '',
        financeEmail: '',
        emergencyContactNumber: ''
      },
      businessSettings: {
        businessType: '',
        parentCompany: '',
        subsidiaryCompanies: [],
        companyDescription: '',
        missionStatement: '',
        visionStatement: '',
        coreValues: []
      },
      operationalSettings: {
        defaultCurrency: 'USD',
        secondaryCurrenciesAllowed: [],
        defaultLanguage: 'en',
        additionalLanguages: [],
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24-hour',
        timezone: 'UTC',
        weekStartDay: 'Monday',
        financialYearStartMonth: 'April',
        financialYearEndMonth: 'March',
        fiscalQuarterSettings: ['Q1', 'Q2', 'Q3', 'Q4']
      },
      subscriptionAndLicensing: {
        currentPlan: 'Free',
        subscriptionStartDate: '',
        subscriptionEndDate: '',
        autoRenewal: false,
        employeeLimit: 0,
        storageLimitGb: 0,
        apiCallLimit: 0,
        customBrandingEnabled: false,
        whiteLabelEnabled: false,
        modulesEnabledList: [],
        addonsPurchased: []
      }
    },
    userAndAccess: {
      userAccountSettings: {
        allowUserRegistration: true,
        emailVerificationRequired: true,
        phoneVerificationRequired: false,
        adminApprovalRequired: false,
        defaultRoleForNewUsers: 'employee',
        passwordMinLength: 8,
        passwordMaxLength: 64,
        requireUppercase: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialCharacter: true,
        passwordExpiryDays: 0,
        passwordReusePreventionCount: 3,
        accountLockoutThreshold: 5,
        accountLockoutDurationMinutes: 15,
        forcePasswordChangeOnFirstLogin: false,
        twoFactorAuthenticationRequired: false,
        twoFactorMethod: 'Authenticator App'
      },
      sessionManagement: {
        sessionTimeoutMinutes: 60,
        idleTimeoutMinutes: 30,
        rememberMeEnabled: true,
        rememberMeDurationDays: 30,
        concurrentSessionsAllowed: true,
        maxActiveSessionsPerUser: 3,
        forceLogoutOnPasswordChange: true,
        ipWhitelistEnabled: false,
        ipWhitelistAddresses: [],
        allowedLoginDevices: ['Desktop', 'Mobile', 'Tablet']
      },
      roleManagement: {
        createCustomRoles: true,
        editSystemRoles: false,
        deleteCustomRoles: true,
        assignMultipleRolesToUser: true,
        roleHierarchyEnabled: true,
        roleBasedDashboard: true,
        roleSwitchingAllowed: false,
        temporaryRoleAssignmentDurationDays: 7
      },
      permissionManagement: {
        granularPermissionsEnabled: true,
        permissionGroups: [],
        inheritPermissionsFromRole: true,
        overrideRolePermissions: true,
        timeBasedPermissions: false,
        locationBasedPermissions: false,
        departmentBasedPermissions: true,
        projectBasedPermissions: false
      },
      accessControl: {
        ipBasedAccessControl: false,
        geofencingEnabled: false,
        deviceBasedAccessControl: false,
        timeBasedAccessControl: false,
        vpnRequiredForRemoteAccess: false,
        apiAccessEnabled: true,
        apiRateLimiting: true,
        thirdPartyAppAccess: true
      }
    },
    employeeManagement: {
      employeeProfileSettings: {
        mandatoryFields: [],
        optionalFields: [],
        customFieldsEnabled: true,
        maximumCustomFields: 50,
        profilePhotoRequired: false,
        profilePhotoMaxSizeMb: 2,
        profilePhotoAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
        employeeIdFormat: 'auto',
        employeeIdPrefix: 'EMP',
        employeeIdStartNumber: 1,
        employeeIdPadding: 5,
        allowSelfUpdateProfile: true,
        fieldsEmployeeCanUpdate: [],
        managerApprovalRequiredForUpdates: false,
        hrApprovalRequiredForUpdates: false
      },
      personalInformationSettings: {
        dobRequired: true,
        genderRequired: true,
        maritalStatusRequired: false,
        bloodGroupRequired: false,
        nationalityRequired: false,
        personalEmailRequired: true,
        personalPhoneRequired: true,
        currentAddressRequired: true,
        permanentAddressRequired: false,
        aadharRequired: false,
        panRequired: false
      },
      employmentDetailsSettings: {
        joiningDateRequired: true,
        probationPeriodMonths: 6,
        noticePeriodDays: 30,
        departmentRequired: true,
        designationRequired: true,
        reportingManagerRequired: true,
        employmentTypeRequired: true,
        workLocationRequired: true,
        shiftAssignmentRequired: false
      },
      documentManagement: {
        documentUploadRequired: false,
        documentTypesList: [],
        documentMaxSizeMb: 10,
        documentAllowedFormats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
        documentExpiryTracking: true,
        documentVerificationRequired: false
      },
      employeeLifecycle: {
        onboardingChecklistEnabled: true,
        onboardingAutoAssignTasks: false,
        probationReviewReminder: true,
        confirmationProcessEnabled: true,
        transferProcessEnabled: true,
        promotionProcessEnabled: true,
        resignationProcessEnabled: true,
        exitInterviewRequired: false,
        finalSettlementProcessEnabled: true
      }
    },
    attendance: {
      generalAttendanceSettings: {
        attendanceTrackingEnabled: true,
        attendanceMethod: 'Web',
        allowMultiplePunchMethods: true,
        autoPunchOutEnabled: true,
        autoPunchOutTime: '23:59',
        gracePeriodLateMinutes: 10,
        gracePeriodEarlyExitMinutes: 10,
        minimumWorkingHours: 8,
        maximumWorkingHours: 12,
        overtimeCalculationEnabled: true
      },
      punchInOutSettings: {
        allowPunchBeforeShiftStart: true,
        beforeShiftStartBufferMinutes: 15,
        preventPunchAfterShiftEnd: false,
        afterShiftEndBufferMinutes: 60,
        gpsLocationRequired: false,
        geofenceEnabled: false,
        geofenceRadiusMeters: 100,
        allowPunchOutsideGeofence: true
      },
      shiftManagement: {
        shiftSystemEnabled: true,
        fixedVsFlexibleShifts: 'fixed',
        shiftStartTime: '09:00',
        shiftEndTime: '18:00',
        breakTimeDurationMinutes: 60,
        lunchBreakMandatory: false,
        shiftRotationEnabled: false
      },
      regularization: {
        regularizationRequestEnabled: true,
        regularizationDaysLimitPast: 7,
        regularizationRequestsPerMonth: 10,
        managerApprovalRequired: true,
        hrApprovalRequired: false
      }
    },
    leaveManagement: {
      generalLeaveSettings: {
        leaveModuleEnabled: true,
        leaveYearStartMonth: 'January',
        leaveYearEndMonth: 'December',
        negativeLeaveBalanceAllowed: false,
        carryForwardEnabled: true,
        carryForwardLimit: 10
      },
      leaveAccrualDefaults: {
        openingBalances: {
          casualLeave: 8,
          sickLeave: 7,
          privilegeLeave: 9.75,
          optionalHoliday: 2
        },
        monthlyCredit: {
          casualLeave: 0,
          sickLeave: 0,
          privilegeLeave: 1.25,
          optionalHoliday: 0
        }
      },
      leaveTypes: {
        casualLeave: true,
        sickLeave: true,
        earnedLeave: true,
        privilegeLeave: false,
        maternityLeave: true,
        paternityLeave: true,
        bereavementLeave: true,
        compensatoryOff: true,
        lossOfPay: true,
        customLeaveTypes: []
      },
      leaveApplicationSettings: {
        advanceLeaveApplicationDays: 1,
        backdatedLeaveAllowed: false,
        halfDayLeaveAllowed: true,
        hourlyLeaveAllowed: false,
        reasonRequired: true,
        documentUploadRequired: false
      },
      leaveApprovalSettings: {
        managerApprovalRequired: true,
        hrApprovalRequired: false,
        multiLevelApproval: false,
        autoApproveConditions: []
      }
    },
    payroll: {
      generalPayrollSettings: {
        payrollModuleEnabled: true,
        payrollProcessDay: 28,
        payrollCycle: 'Monthly',
        salaryPaymentDate: 30,
        currency: 'USD',
        statutoryComplianceEnabled: true,
        providentFundEnabled: false,
        esiEnabled: false,
        professionalTaxEnabled: false,
        tdsEnabled: false,
        gratuityEnabled: false,
        bonusCalculationEnabled: false
      },
      salaryStructureSettings: {
        salaryStructureTemplates: [],
        basicSalaryPercentage: 40,
        hraPercentage: 20,
        specialAllowance: true,
        customAllowances: []
      },
      deductionSettings: {
        pfEmployeeContributionPercent: 0,
        pfEmployerContributionPercent: 0,
        esiEmployeeContributionPercent: 0,
        esiEmployerContributionPercent: 0,
        tdsCalculationMethod: 'standard',
        lateAbsentDeductionEnabled: false
      },
      payslipSettings: {
        payslipTemplate: 'default',
        companyLogoOnPayslip: true,
        digitalSignature: false,
        payslipPasswordProtection: false,
        payslipEmailDelivery: true,
        payslipDownloadAccess: true
      }
    },
    performanceManagement: {
      generalSettings: {
        performanceModuleEnabled: true,
        performanceCycle: 'Annual',
        selfAppraisalEnabled: true,
        managerAppraisalEnabled: true,
        peerReviewEnabled: false,
        feedback360Enabled: false
      },
      goalSetting: {
        goalSettingEnabled: true,
        goalTypes: ['Individual', 'Team', 'Department'],
        smartGoalsFramework: true,
        okrFramework: false,
        kpiFramework: true,
        goalProgressTracking: true
      },
      reviewSettings: {
        reviewFormTemplate: 'default',
        ratingScale: '1-5',
        commentsRequired: true,
        developmentPlanRequired: false
      }
    },
    recruitment: {
      generalSettings: {
        recruitmentModuleEnabled: true,
        careerPageEnabled: true,
        applyWithoutLogin: true,
        referralProgramEnabled: true,
        atsEnabled: true
      },
      jobPostingSettings: {
        jobPostingApprovalRequired: true,
        autoPostToCareerPage: true,
        autoPostToJobBoards: false,
        jobExpiryDurationDays: 30
      },
      interviewProcess: {
        interviewStages: ['Screening', 'Technical', 'HR'],
        interviewTypes: ['Phone', 'Video', 'In-Person'],
        interviewSchedulingEnabled: true,
        autoSendInterviewInvite: true
      },
      onboarding: {
        preOnboardingChecklist: true,
        onboardingChecklist: true,
        documentCollection: true,
        accessProvisioning: true,
        onboardingTraining: true
      }
    },
    assetsAndInventory: {
      assetManagement: {
        assetModuleEnabled: true,
        assetCategories: [],
        assetTrackingSystem: true,
        assetAssignmentRules: true,
        assetReturnProcess: true,
        assetMaintenanceSchedule: true
      },
      inventorySettings: {
        inventoryTracking: true,
        stockAlertLevel: 10,
        autoReorderEnabled: false,
        reorderQuantity: 0
      }
    },
    documentManagement: {
      documentStorage: {
        storageLimitGb: 10,
        fileSizeLimitMb: 10,
        allowedFileFormats: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
        versionControlEnabled: true,
        documentRetentionPolicyYears: 7
      },
      documentAccess: {
        viewOnlyAccess: false,
        downloadPermission: true,
        editPermission: true,
        deletePermission: false,
        sharePermission: true,
        watermarkOnDocuments: false
      },
      eSignature: {
        enabled: false,
        provider: '',
        multiSignatureRequired: false
      }
    },
    communication: {
      emailSettings: {
        emailProvider: 'SMTP',
        fromEmailAddress: '',
        fromName: '',
        replyToEmail: '',
        emailFooter: '',
        emailSignature: ''
      },
      notifications: {
        pushNotificationsEnabled: true,
        inAppNotificationsEnabled: true,
        doNotDisturbHours: '',
        notificationRetentionDays: 30
      },
      announcements: {
        companyAnnouncements: true,
        departmentAnnouncements: true,
        announcementBanner: true,
        announcementPopup: false
      },
      chatAndMessaging: {
        internalChatEnabled: false,
        groupChatEnabled: false,
        fileSharingInChat: false
      }
    },
    reportsAndAnalytics: {
      reportAccess: {
        reportAccessByRole: true,
        scheduledReports: true,
        reportEmailDelivery: true,
        exportFormats: ['PDF', 'Excel', 'CSV'],
        customReportBuilder: true
      },
      dashboardSettings: {
        customDashboards: true,
        roleBasedDashboards: true,
        widgetLibrary: true,
        realTimeData: false,
        dashboardRefreshFrequencySeconds: 300
      },
      analyticsSettings: {
        predictiveAnalytics: false,
        trendAnalysis: true,
        attritionPrediction: false,
        hiringForecast: false,
        workforcePlanning: true
      }
    },
    integrations: {
      ssoAndAuthentication: {
        ssoEnabled: false,
        saml2Enabled: false,
        oauth2Enabled: true,
        googleWorkspaceSso: false,
        microsoft365Sso: false,
        oktaIntegration: false
      },
      accountingSoftware: {
        quickbooksIntegration: false,
        tallyIntegration: false,
        zohoBooksIntegration: false,
        sapIntegration: false
      },
      communicationTools: {
        slackIntegration: false,
        microsoftTeamsIntegration: false,
        zoomIntegration: false,
        googleMeetIntegration: false,
        whatsappBusinessApi: false
      },
      apiManagement: {
        restApiEnabled: true,
        apiDocumentationEnabled: true,
        apiKeysManagement: true,
        apiRateLimiting: true,
        webhookConfiguration: true
      }
    },
    security: {
      dataSecurity: {
        encryptionAtRest: true,
        encryptionInTransit: true,
        databaseEncryption: false,
        backupEncryption: false,
        fieldLevelEncryption: false
      },
      backupAndRecovery: {
        autoBackupEnabled: true,
        backupFrequency: 'Daily',
        backupRetentionDays: 30,
        disasterRecoveryPlan: true
      },
      auditAndLogging: {
        activityLoggingEnabled: true,
        loginHistory: true,
        userActivityLog: true,
        adminActivityLog: true,
        failedLoginAttemptsTracking: true,
        logRetentionPeriodDays: 180
      },
      privacyAndCompliance: {
        gdprCompliance: false,
        consentManagement: false,
        rightToBeForgotten: false,
        dataPortability: false,
        laborLawCompliance: true,
        taxCompliance: true
      }
    },
    customization: {
      branding: {
        companyLogo: true,
        companyFavicon: true,
        primaryColor: '#1E7BFF',
        secondaryColor: '#12B2F5',
        accentColor: '#10B981',
        fontFamily: 'Manrope',
        customCss: '',
        loginPageBackground: '',
        dashboardBackground: ''
      },
      uiCustomization: {
        theme: 'Light',
        sidebarLayout: 'default',
        topNavigation: true,
        compactView: false,
        customMenuItems: [],
        hideShowModules: []
      },
      workflows: {
        customApprovalWorkflows: true,
        multiStepApproval: true,
        conditionalApproval: true,
        escalationRules: true,
        autoApprovalRules: true
      },
      labelsAndTerminology: {
        renameModules: true,
        renameFields: true,
        customLabels: {},
        multiLanguageSupport: true
      }
    },
    additional: {
      employeeSelfService: {
        essPortalEnabled: true,
        profileUpdateAccess: true,
        attendanceView: true,
        leaveApplication: true,
        payslipDownload: true
      },
      managerSelfService: {
        mssPortalEnabled: true,
        teamViewAccess: true,
        approvalDashboard: true,
        teamReportsAccess: true
      },
      helpdeskSupport: {
        internalHelpdesk: false,
        ticketCategories: [],
        slaConfiguration: false,
        knowledgeBase: false
      },
      eventsAndCalendar: {
        companyCalendar: true,
        holidayCalendar: true,
        teamCalendar: true,
        birthdayCalendar: true,
        anniversaryCalendar: true
      }
    },
    system: {
      generalSystem: {
        maintenanceMode: false,
        maintenanceMessage: '',
        systemStatusPage: true,
        uptimeMonitoring: true,
        errorTracking: true,
        performanceMonitoring: true
      },
      updatesAndVersioning: {
        autoUpdateEnabled: false,
        updateNotifications: true,
        rollbackOption: true,
        betaFeaturesAccess: false,
        featureFlags: {}
      },
      dataManagement: {
        dataImportExport: true,
        bulkUploadTemplates: true,
        dataValidationRules: true,
        duplicateDetection: true,
        dataArchival: true,
        dataDeletionPolicy: ''
      }
    },
    custom: {}
  };
};
