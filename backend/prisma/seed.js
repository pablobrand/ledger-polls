import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COUNTRIES = [
  { country: 'United States', states: ['Texas', 'California', 'Florida', 'New York'], cities: ['Austin', 'Dallas', 'Los Angeles', 'Miami', 'New York'] },
  { country: 'Canada', states: ['Ontario', 'Quebec', 'British Columbia'], cities: ['Toronto', 'Montreal', 'Vancouver'] },
  { country: 'Mexico', states: ['Jalisco', 'Nuevo Leon', 'CDMX'], cities: ['Guadalajara', 'Monterrey', 'Mexico City'] },
  { country: 'Brazil', states: ['Sao Paulo', 'Rio de Janeiro', 'Bahia'], cities: ['Sao Paulo', 'Rio de Janeiro', 'Salvador'] },
  { country: 'Spain', states: ['Madrid', 'Catalonia', 'Andalusia'], cities: ['Madrid', 'Barcelona', 'Seville'] },
];

const SEX_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];
const EDUCATION_OPTIONS = [
  'High school',
  'Some college',
  "Bachelor's degree",
  "Master's degree",
  'Doctorate',
  'Trade/Technical certificate',
  'Prefer not to say',
];
const EMPLOYMENT_OPTIONS = [
  'Employed full-time',
  'Employed part-time',
  'Self-employed',
  'Student',
  'Unemployed',
  'Retired',
  'Prefer not to say',
];
const INCOME_OPTIONS = ['Under 25k', '25k-49k', '50k-74k', '75k-99k', '100k-149k', '150k+', 'Prefer not to say'];
const MARITAL_OPTIONS = ['Single', 'Married', 'Domestic partnership', 'Divorced', 'Widowed', 'Prefer not to say'];
const DEVICE_OPTIONS = ['Android', 'iOS', 'Desktop', 'Tablet', 'Other'];
const INTERNET_OPTIONS = ['Mobile data only', 'Home broadband', 'Work/school network', 'Mixed'];
const AVAILABILITY_OPTIONS = ['Weekdays', 'Weeknights', 'Weekends', 'Anytime'];
const FREQUENCY_OPTIONS = ['Rarely', 'Monthly', 'Weekly', 'Frequently'];

function randomItem(list) {
  return list[crypto.randomInt(0, list.length)];
}

function randomBirthYear() {
  // Age range 18-72
  const year = new Date().getFullYear() - crypto.randomInt(18, 73);
  return String(year);
}

function randomBirthMonth() {
  return String(crypto.randomInt(1, 13)).padStart(2, '0');
}

function buildProfile() {
  const location = randomItem(COUNTRIES);
  return {
    city: randomItem(location.cities),
    state: randomItem(location.states),
    country: location.country,
    birthYear: randomBirthYear(),
    birthMonth: randomBirthMonth(),
    sex: randomItem(SEX_OPTIONS),
    educationLevel: randomItem(EDUCATION_OPTIONS),
    employmentStatus: randomItem(EMPLOYMENT_OPTIONS),
    householdIncomeBracket: randomItem(INCOME_OPTIONS),
    maritalStatus: randomItem(MARITAL_OPTIONS),
    primaryDeviceType: randomItem(DEVICE_OPTIONS),
    internetAccessType: randomItem(INTERNET_OPTIONS),
    surveyAvailability: randomItem(AVAILABILITY_OPTIONS),
    participationFrequency: randomItem(FREQUENCY_OPTIONS),
  };
}

function buildEnvelope() {
  // Synthetic envelope for test data only.
  return {
    alg: 'AES-GCM-256',
    ct: crypto.randomBytes(48).toString('base64'),
    iv: crypto.randomBytes(12).toString('base64'),
    tag: crypto.randomBytes(16).toString('base64'),
    v: 1,
  };
}

function toFieldJson(value) {
  return {
    v: String(value ?? ''),
  };
}

async function main() {
  const seedWalletPrefix = 'seed_wallet_';

  // Idempotent reruns: remove prior seeded users and dependent rows via cascade.
  await prisma.user.deleteMany({
    where: { walletAddress: { startsWith: seedWalletPrefix } },
  });

  const usersToCreate = Array.from({ length: 20 }, (_, i) => ({
    walletAddress: `${seedWalletPrefix}${String(i + 1).padStart(3, '0')}`,
    generatedUserId: `uid_seed_${crypto.randomBytes(12).toString('hex')}`,
    walletProvider: 'phantom',
    walletPublicKey: `seed_pub_${crypto.randomBytes(16).toString('hex')}`,
  }));

  await prisma.user.createMany({ data: usersToCreate });

  const users = await prisma.user.findMany({
    where: { walletAddress: { startsWith: seedWalletPrefix } },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  const blobs = users.map((u) => {
    const profile = buildProfile();
    return {
      ownerUserId: u.id,
      kind: 'persona',
      envelope: buildEnvelope(),
      meta: {
        profile,
        fields: Object.keys(profile),
        source: 'seed-script',
      },
    };
  });

  const personas = users.map((u, idx) => {
    const profile = blobs[idx].meta.profile;
    return {
      userId: u.id,
      city: toFieldJson(profile.city),
      region: toFieldJson(profile.state),
      country: toFieldJson(profile.country),
      education: toFieldJson(profile.educationLevel),
      employment: toFieldJson(profile.employmentStatus),
      income: toFieldJson(profile.householdIncomeBracket),
      profileFacts: profile,
    };
  });

  await prisma.encryptedBlob.createMany({ data: blobs });
  await prisma.persona.createMany({ data: personas });

  console.log(`Seeded ${users.length} synthetic personas for initial testing (encrypted_blobs + personas).`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
