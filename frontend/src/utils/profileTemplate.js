export const profileOptions = {
  sex: ['Male', 'Female', 'Other', 'Prefer not to say'],
  educationLevel: [
    'High school',
    'Some college',
    'Bachelor\'s degree',
    'Master\'s degree',
    'Doctorate',
    'Trade/Technical certificate',
    'Prefer not to say',
  ],
  employmentStatus: [
    'Employed full-time',
    'Employed part-time',
    'Self-employed',
    'Student',
    'Unemployed',
    'Retired',
    'Prefer not to say',
  ],
  householdIncomeBracket: [
    'Under 25k',
    '25k-49k',
    '50k-74k',
    '75k-99k',
    '100k-149k',
    '150k+',
    'Prefer not to say',
  ],
  maritalStatus: [
    'Single',
    'Married',
    'Domestic partnership',
    'Divorced',
    'Widowed',
    'Prefer not to say',
  ],
  primaryDeviceType: ['Android', 'iOS', 'Desktop', 'Tablet', 'Other'],
  surveyAvailability: ['Weekdays', 'Weeknights', 'Weekends', 'Anytime'],
  internetAccessType: ['Mobile data only', 'Home broadband', 'Work/school network', 'Mixed'],
  participationFrequency: ['Rarely', 'Monthly', 'Weekly', 'Frequently'],
};

const currentYear = new Date().getFullYear();
export const birthYearOptions = Array.from({ length: 80 }, (_, idx) => String(currentYear - 18 - idx));
export const birthMonthOptions = [
  '01', '02', '03', '04', '05', '06',
  '07', '08', '09', '10', '11', '12',
];

export const defaultSurveyProfile = {
  city: '',
  state: '',
  country: '',
  birthYear: '',
  birthMonth: '',
  sex: '',
  educationLevel: '',
  employmentStatus: '',
  householdIncomeBracket: '',
  maritalStatus: '',
  primaryDeviceType: '',
  internetAccessType: '',
  surveyAvailability: '',
  participationFrequency: '',
};

export const profileFieldLabels = {
  city: 'City',
  state: 'State/Region',
  country: 'Country',
  birthYear: 'Birth Year',
  birthMonth: 'Birth Month',
  sex: 'Sex',
  educationLevel: 'Education Level',
  employmentStatus: 'Employment Status',
  householdIncomeBracket: 'Household Income Bracket',
  maritalStatus: 'Marital Status',
  primaryDeviceType: 'Primary Device',
  internetAccessType: 'Internet Access',
  surveyAvailability: 'Typical Survey Availability',
  participationFrequency: 'Survey Participation Frequency',
};
