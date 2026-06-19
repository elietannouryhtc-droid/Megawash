const translations = {
  en: {
    // General
    appName: "Car Wash Portal",
    language: "Français",
    logout: "Logout",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    add: "Add",
    actions: "Actions",
    status: "Status",
    date: "Date",
    time: "Time",
    search: "Search...",
    loading: "Loading...",
    success: "Success",
    error: "Error",
    close: "Close",
    approve: "Approve",
    reject: "Reject",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",

    // Auth / Login
    loginTitle: "Staff Portal Login",
    username: "Username / Email",
    password: "Password",
    pinCode: "PIN Code (for Keypad)",
    loginBtn: "Sign In",
    loginError: "Invalid credentials. Please try again.",
    pinError: "Invalid PIN code.",
    welcomeBack: "Welcome back!",

    // Keypad (Employee Check-in/out)
    keypadTitle: "Employee Attendance",
    enterPin: "Enter Your 4-Digit PIN",
    checkIn: "Check In",
    checkOut: "Check Out",
    statusTitle: "Current Status",
    activeStaff: "Active Staff on Duty",
    todayActions: "Today's Activity Log",
    employeeName: "Employee",
    checkInTime: "Check-In Time",
    lastAction: "Last Action",
    pinCleared: "PIN cleared.",
    checkInSuccess: "Successfully checked in at {time}!",
    checkOutSuccess: "Successfully checked out at {time}! Hours worked: {hours} hrs.",
    alreadyCheckedIn: "You are already checked in.",
    alreadyCheckedOut: "You are already checked out.",
    invalidPinLength: "PIN must be 4 digits.",

    // Admin Sidebar & Navigation
    navDashboard: "Dashboard",
    navEmployees: "Employees",
    navTimesheets: "Timesheets",
    navPayroll: "Payroll",
    navAdvances: "Salary Advances",
    navReports: "Reports",
    navAudit: "Audit Logs",
    navSettings: "Settings",
    navMore: "More",

    // Admin Dashboard
    dashTitle: "Dashboard Overview",
    statActiveEmployees: "On-Duty Employees",
    statWorkedHours: "Total Worked Hours (Week)",
    statPendingAdvances: "Pending Advances",
    statWeeklyPayroll: "Estimated Weekly Payroll",
    recentActivity: "Recent System Activity",
    employeeActivity: "Employee Logins & Shifts",
    viewAll: "View All",

    // Admin Employees
    empTitle: "Employee Management",
    addEmpBtn: "Add New Employee",
    editEmpBtn: "Edit Employee",
    empNameHeader: "Full Name",
    empRoleHeader: "Role",
    empRateHeader: "Hourly Rate",
    empPinHeader: "PIN Code",
    empStatusHeader: "Status",
    active: "Active",
    inactive: "Inactive",
    empRoleAdmin: "Admin",
    empRoleEmployee: "Employee",
    empRoleDetail: "Role Detail",
    rateHelp: "Hourly wage in local currency",
    pinHelp: "4-digit unique numerical code",

    // Admin Timesheets
    timeTitle: "Shift Timesheets",
    filterEmployee: "Filter by Employee",
    filterDate: "Filter by Date",
    checkInHeader: "Clock-In",
    checkOutHeader: "Clock-Out",
    totalHoursHeader: "Hours",
    statusApproved: "Approved",
    statusPending: "Awaiting Approval",
    approveBtn: "Approve",
    editShift: "Edit Shift",
    addShiftBtn: "Manual Shift Entry",
    shiftDetails: "Shift Details",

    // Admin Payroll
    payTitle: "Payroll Processing",
    payPeriod: "Payroll Period",
    calcPayrollBtn: "Calculate Payroll",
    regularHours: "Regular Hours",
    overtimeHours: "Overtime Hours",
    grossPay: "Gross Earnings",
    advancesDeducted: "Advances Deducted",
    netPay: "Net Salary",
    paymentStatus: "Payment Status",
    paidStatus: "Paid",
    unpaidStatus: "Unpaid",
    processPaymentBtn: "Process Payment",
    paySlipTitle: "Payslip Summary",

    // Admin Advances
    advTitle: "Salary Advances",
    requestAdvanceBtn: "Record Salary Advance",
    advDate: "Request Date",
    advAmount: "Amount",
    advReason: "Reason / Note",
    advStatus: "Approval Status",
    confirmAdvanceApprove: "Are you sure you want to approve this advance of {amount}?",
    confirmAdvanceReject: "Are you sure you want to reject this advance?",

    // Admin Reports
    repTitle: "Business Reports",
    startDate: "Start Date",
    endDate: "End Date",
    generateReport: "Generate Report",
    exportPDF: "Export PDF",
    exportExcel: "Export CSV",
    repTotalShifts: "Total Shifts",
    repTotalHours: "Total Worked Hours",
    repTotalPayroll: "Total Payroll Paid",
    repTotalAdvances: "Total Advances Given",
    chartHoursByEmployee: "Hours by Employee",
    chartWeeklyCosts: "Payroll Costs",
    chartAttendanceTrends: "Attendance Trends",

    // Admin Audit
    auditTitle: "System Audit Logs",
    auditAction: "Action / Event",
    auditUser: "Performed By",
    auditDetails: "Details",
    auditIp: "IP Address",

    // Admin Settings
    setSubTitle: "Configure System Settings",
    setCompany: "Company Name",
    setCurrency: "Currency Symbol",
    setOvertimeRate: "Overtime Rate Multiplier (e.g. 1.5)",
    setOvertimeThreshold: "Weekly Overtime Threshold (hours)",
    setTaxRate: "Estimated Payroll Tax Deduction (%)",
    settingsSaved: "System settings saved successfully."
  },
  fr: {
    // General
    appName: "Portail Lave-Auto",
    language: "English",
    logout: "Déconnexion",
    save: "Sauvegarder",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    add: "Ajouter",
    actions: "Actions",
    status: "Statut",
    date: "Date",
    time: "Heure",
    search: "Recherche...",
    loading: "Chargement...",
    success: "Succès",
    error: "Erreur",
    close: "Fermer",
    approve: "Approuver",
    reject: "Rejeter",
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Rejeté",

    // Auth / Login
    loginTitle: "Connexion Portail Employés",
    username: "Nom d'utilisateur / Email",
    password: "Mot de passe",
    pinCode: "Code PIN (pour clavier)",
    loginBtn: "Se connecter",
    loginError: "Identifiants invalides. Veuillez réessayer.",
    pinError: "Code PIN invalide.",
    welcomeBack: "Bon retour !",

    // Keypad (Employee Check-in/out)
    keypadTitle: "Présence des Employés",
    enterPin: "Entrez votre PIN à 4 chiffres",
    checkIn: "Arrivée (Check In)",
    checkOut: "Départ (Check Out)",
    statusTitle: "Statut Actuel",
    activeStaff: "Personnel en Service",
    todayActions: "Journal d'activité d'aujourd'hui",
    employeeName: "Employé",
    checkInTime: "Heure d'arrivée",
    lastAction: "Dernière action",
    pinCleared: "PIN effacé.",
    checkInSuccess: "Arrivée enregistrée avec succès à {time} !",
    checkOutSuccess: "Départ enregistré avec succès à {time} ! Heures travaillées : {hours} h.",
    alreadyCheckedIn: "Vous êtes déjà enregistré à l'arrivée.",
    alreadyCheckedOut: "Vous êtes déjà enregistré au départ.",
    invalidPinLength: "Le PIN doit comporter 4 chiffres.",

    // Admin Sidebar & Navigation
    navDashboard: "Tableau de Bord",
    navEmployees: "Employés",
    navTimesheets: "Feuilles de Temps",
    navPayroll: "Paie",
    navAdvances: "Avances sur Salaire",
    navReports: "Rapports",
    navAudit: "Journal d'Audit",
    navSettings: "Configuration",
    navMore: "Plus",

    // Admin Dashboard
    dashTitle: "Aperçu du Tableau de Bord",
    statActiveEmployees: "Employés en Service",
    statWorkedHours: "Total Heures Travaillées (Semaine)",
    statPendingAdvances: "Avances en Attente",
    statWeeklyPayroll: "Masse Salariale Estimée (Semaine)",
    recentActivity: "Activité Récente du Système",
    employeeActivity: "Connexions & Shifts des Employés",
    viewAll: "Tout Afficher",

    // Admin Employees
    empTitle: "Gestion des Employés",
    addEmpBtn: "Ajouter un Employé",
    editEmpBtn: "Modifier l'Employé",
    empNameHeader: "Nom Complet",
    empRoleHeader: "Rôle",
    empRateHeader: "Taux Horaire",
    empPinHeader: "Code PIN",
    empStatusHeader: "Statut",
    active: "Actif",
    inactive: "Inactif",
    empRoleAdmin: "Administrateur",
    empRoleEmployee: "Employé",
    empRoleDetail: "Détail du Rôle",
    rateHelp: "Salaire horaire en devise locale",
    pinHelp: "Code numérique unique à 4 chiffres",

    // Admin Timesheets
    timeTitle: "Feuilles de Temps",
    filterEmployee: "Filtrer par Employé",
    filterDate: "Filtrer par Date",
    checkInHeader: "Entrée",
    checkOutHeader: "Sortie",
    totalHoursHeader: "Heures",
    statusApproved: "Approuvé",
    statusPending: "En attente d'approbation",
    approveBtn: "Approuver",
    editShift: "Modifier le Shift",
    addShiftBtn: "Saisie Manuelle de Shift",
    shiftDetails: "Détails du Shift",

    // Admin Payroll
    payTitle: "Traitement de la Paie",
    payPeriod: "Période de Paie",
    calcPayrollBtn: "Calculer la Paie",
    regularHours: "Heures Régulières",
    overtimeHours: "Heures Supplémentaires",
    grossPay: "Salaire Brut",
    advancesDeducted: "Avances Déduites",
    netPay: "Salaire Net",
    paymentStatus: "Statut de Paiement",
    paidStatus: "Payé",
    unpaidStatus: "Non Payé",
    processPaymentBtn: "Traiter le Paiement",
    paySlipTitle: "Sommaire de Fiche de Paie",

    // Admin Advances
    advTitle: "Avances sur Salaire",
    requestAdvanceBtn: "Enregistrer une Avance",
    advDate: "Date de Demande",
    advAmount: "Montant",
    advReason: "Raison / Note",
    advStatus: "Statut d'Approbation",
    confirmAdvanceApprove: "Êtes-vous sûr de vouloir approuver cette avance de {amount} ?",
    confirmAdvanceReject: "Êtes-vous sûr de vouloir rejeter cette avance ?",

    // Admin Reports
    repTitle: "Rapports d'Activité",
    startDate: "Date de Début",
    endDate: "Date de Fin",
    generateReport: "Générer le Rapport",
    exportPDF: "Exporter en PDF",
    exportExcel: "Exporter en CSV",
    repTotalShifts: "Total de Shifts",
    repTotalHours: "Total d'Heures Travaillées",
    repTotalPayroll: "Total Salaires Versés",
    repTotalAdvances: "Total Avances Versées",
    chartHoursByEmployee: "Heures par Employé",
    chartWeeklyCosts: "Coûts de la Paie",
    chartAttendanceTrends: "Tendances de Présence",

    // Admin Audit
    auditTitle: "Journal d'Audit Système",
    auditAction: "Action / Événement",
    auditUser: "Effectué Par",
    auditDetails: "Détails",
    auditIp: "Adresse IP",

    // Admin Settings
    setSubTitle: "Configuration des Paramètres Système",
    setCompany: "Nom de l'Entreprise",
    setCurrency: "Symbole Devise",
    setOvertimeRate: "Multiplicateur Heures Suppl. (ex: 1.5)",
    setOvertimeThreshold: "Seuil Heures Suppl. (par semaine)",
    setTaxRate: "Déduction Fiscale Estimée (%)",
    settingsSaved: "Paramètres système enregistrés avec succès."
  }
};

let currentLang = localStorage.getItem('mw_lang') || 'en';

function setLanguage(lang) {
  if (translations[lang]) {
    currentLang = lang;
    localStorage.setItem('mw_lang', lang);
    applyTranslations();
  }
}

function t(key, replacements = {}) {
  const lang = currentLang;
  let translation = translations[lang] && translations[lang][key] ? translations[lang][key] : (translations['en'][key] || key);
  
  // Replace variables in curly braces
  for (const placeholder in replacements) {
    translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
  }
  
  return translation;
}

function applyTranslations() {
  // Update elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });

  // Update elements with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key));
  });

  // Update language switcher text (if it exists)
  const langToggle = document.getElementById('languageToggle');
  if (langToggle) {
    langToggle.textContent = currentLang === 'en' ? 'FR' : 'EN';
  }

  // Handle page layout updates for language specific styling
  document.documentElement.setAttribute('lang', currentLang);
  document.body.classList.remove('lang-en', 'lang-fr');
  document.body.classList.add(`lang-${currentLang}`);

  // Dispatch custom event so that components can refresh tables or charts
  document.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLang } }));
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
  applyTranslations();

  const langToggle = document.getElementById('languageToggle');
  if (langToggle) {
    langToggle.addEventListener('click', (e) => {
      e.preventDefault();
      const targetLang = currentLang === 'en' ? 'fr' : 'en';
      setLanguage(targetLang);
    });
  }
});
