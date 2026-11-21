import type { AcademicProfile, DocumentType, EncryptedDocument, Program } from '../types.ts';

export interface LivingExpensesGuide {
  currencyLabel: string;
  housingMonthlyUsd: number;
  foodMonthlyUsd: number;
  transitUtilitiesMonthlyUsd: number;
  healthInsuranceMonthlyUsd: number;
  totalMonthlyUsd: number;
  totalAnnualUsd: number;
  housingTip: string;
}

export interface VisaGuide {
  visaName: string;
  visaFeeUsd: number;
  healthSurchargeUsd: number;
  proofOfFundsUsd: number;
  proofOfFundsNote: string;
  processingWeeks: string;
  embassySteps: string[];
}

export interface AirTicketGuide {
  airportCode: string;
  airportName: string;
  estimatedOneWayUsd: number;
  estimatedRoundTripUsd: number;
  bookingTip: string;
  localTransferNote: string;
}

export interface JourneyStep {
  id: string;
  stepNumber: number;
  phase: string;
  title: string;
  description: string;
  timelineHint: string;
}

export interface UniversityGuide {
  living: LivingExpensesGuide;
  visa: VisaGuide;
  airTicket: AirTicketGuide;
  firstYearTotalUsd: number;
  steps: JourneyStep[];
}

export function inferVaultDocType(requirementText: string): DocumentType {
  const lower = requirementText.toLowerCase();
  if (
    lower.includes('transcript') ||
    lower.includes('diploma') ||
    lower.includes('certificate') ||
    lower.includes('syllabus')
  ) {
    return 'Transcript';
  }
  if (lower.includes('recommend') || lower.includes('reference') || lower.includes('endorsement')) {
    return 'Recommendation Letter';
  }
  if (
    lower.includes('passport') ||
    lower.includes('nationality') ||
    lower.includes('financial') ||
    lower.includes('affidavit') ||
    lower.includes('uni-assist')
  ) {
    return 'Passport / ID';
  }
  return 'Statement of Purpose';
}

export function evaluateUniversityChance(
  prog: Program,
  profile: AcademicProfile,
  documents: EncryptedDocument[],
) {
  const acceptPct = parseFloat(prog.acceptanceRate) || 15;
  let prob = 46 + Math.min(20, acceptPct * 0.75);
  const reasons: string[] = [];

  const minGpa = prog.minGpaRecommended ?? (prog.qsRank <= 10 ? 3.7 : prog.qsRank <= 30 ? 3.5 : 3.25);
  const gpaDiff = profile.gpa - minGpa;
  if (gpaDiff >= 0.35) {
    prob += 22;
    reasons.push(`GPA ${profile.gpa.toFixed(2)} exceeds recommended ${minGpa.toFixed(2)}`);
  } else if (gpaDiff >= 0.05) {
    prob += 14;
    reasons.push(`GPA ${profile.gpa.toFixed(2)} meets competitive target (${minGpa.toFixed(2)})`);
  } else if (gpaDiff >= -0.2) {
    prob += 3;
    reasons.push(`GPA ${profile.gpa.toFixed(2)} is near benchmark ${minGpa.toFixed(2)} (strong SOP & CV recommended)`);
  } else if (gpaDiff >= -0.4) {
    prob -= 10;
    reasons.push(`GPA ${profile.gpa.toFixed(2)} is below benchmark ${minGpa.toFixed(2)} — bolster with research/work experience`);
  } else {
    prob -= 20;
    reasons.push(`GPA ${profile.gpa.toFixed(2)} is significantly below typical cutoff (${minGpa.toFixed(2)})`);
  }

  if (prog.degreeLevel === profile.degreeTarget) {
    prob += 12;
    reasons.push(`Matches target degree (${prog.degreeLevel})`);
  } else {
    prob -= 10;
    reasons.push(`Offered at ${prog.degreeLevel} level (your target: ${profile.degreeTarget})`);
  }

  const fieldWords = profile.field
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 2 && w !== 'and' && w !== 'in');
  const progText = `${prog.field} ${prog.title}`.toLowerCase();
  const fieldOverlap = fieldWords.filter((w) => progText.includes(w));
  if (fieldOverlap.length > 0) {
    prob += 14;
    reasons.push(`Strong field alignment (${prog.field})`);
  } else {
    prob -= 6;
    reasons.push(`Adjacent field (${prog.field}) — highlight transferable coursework`);
  }

  const engText = profile.englishScore.toUpperCase();
  const ieltsMatch = engText.match(/IELTS\s*([\d.]+)/);
  const toeflMatch = engText.match(/TOEFL\s*(\d+)/);
  const ieltsVal = ieltsMatch ? parseFloat(ieltsMatch[1]) : 0;
  const toeflVal = toeflMatch ? parseInt(toeflMatch[1], 10) : 0;
  if (ieltsVal >= 7.5 || toeflVal >= 100) {
    prob += 8;
    reasons.push(`${profile.englishScore} exceeds standard language requirement`);
  } else if (ieltsVal >= 6.5 || toeflVal >= 85) {
    prob += 4;
    reasons.push(`${profile.englishScore} meets standard language threshold`);
  } else if (ieltsVal > 0 || toeflVal > 0) {
    prob -= 8;
    reasons.push(`${profile.englishScore} may require a higher score for direct admission`);
  }

  if ((profile.workExperienceMonths || 0) >= 12) {
    prob += 4;
  }

  const normalizeCountry = (c: string) => {
    const s = c.trim().toLowerCase();
    if (s === 'usa' || s === 'us' || s === 'america') return 'united states';
    if (s === 'uk' || s === 'britain' || s === 'england') return 'united kingdom';
    return s;
  };
  const targets = profile.targetCountries.map(normalizeCountry).filter(Boolean);
  const countryMatched =
    targets.length === 0 ||
    targets.some(
      (tCountry) => prog.country.toLowerCase().includes(tCountry) || tCountry.includes(prog.country.toLowerCase()),
    );

  if (targets.length > 0 && countryMatched) {
    prob += 5;
    reasons.push(`Matches preferred destination (${prog.country})`);
  }

  const probability = Math.max(12, Math.min(94, Math.round(prob)));
  const chanceLabel =
    probability >= 72
      ? 'High Chance (Strong Fit)'
      : probability >= 54
        ? 'Competitive Match'
        : probability >= 36
          ? 'Moderate Chance'
          : 'Selective / Reach';

  const docStrings =
    prog.requiredDocuments && prog.requiredDocuments.length > 0
      ? prog.requiredDocuments
      : [
          'Official Academic Transcripts',
          'Statement of Purpose (SOP)',
          '2 Academic Recommendation Letters',
          'English Proficiency Proof (IELTS / TOEFL)',
          'Valid Passport Copy',
        ];

  const requiredDocs = docStrings.map((label) => {
    const vaultDocType = inferVaultDocType(label);
    const inVault = documents.find((d) => d.docType === vaultDocType);
    return { label, vaultDocType, inVault };
  });

  return {
    program: prog,
    probability,
    chanceLabel,
    countryMatched,
    reasons,
    requiredDocs,
  };
}

function getAirportForCity(city: string, country: string): AirTicketGuide {
  const c = city.toLowerCase();
  const co = country.toLowerCase();

  if (c.includes('zurich')) {
    return {
      airportCode: 'ZRH',
      airportName: 'Zurich Airport',
      estimatedOneWayUsd: 680,
      estimatedRoundTripUsd: 1120,
      bookingTip: 'Book 8–10 weeks before semester start; student fares on SWISS/Lufthansa often include 2x23 kg luggage.',
      localTransferNote: 'SBB Airport Rail reaches Zurich HB & ETH campus in 12 minutes (~$8).',
    };
  }
  if (c.includes('lausanne')) {
    return {
      airportCode: 'GVA',
      airportName: 'Geneva Airport',
      estimatedOneWayUsd: 690,
      estimatedRoundTripUsd: 1140,
      bookingTip: 'Fly into Geneva (GVA) and take the direct IR train along Lake Geneva to Lausanne.',
      localTransferNote: 'Direct SBB train from GVA to Lausanne takes 45 minutes; metro M1 connects directly to EPFL.',
    };
  }
  if (c.includes('munich')) {
    return {
      airportCode: 'MUC',
      airportName: 'Munich International Airport',
      estimatedOneWayUsd: 620,
      estimatedRoundTripUsd: 980,
      bookingTip: 'Target mid-week departures in September or March; avoid Oktoberfest surge weeks.',
      localTransferNote: 'S-Bahn S1/S8 connects MUC to central Munich & TUM campuses in ~40 minutes (~$14).',
    };
  }
  if (c.includes('aachen') || c.includes('heidelberg')) {
    return {
      airportCode: 'FRA',
      airportName: 'Frankfurt International Airport',
      estimatedOneWayUsd: 590,
      estimatedRoundTripUsd: 950,
      bookingTip: 'Book Lufthansa Rail&Fly tickets to include free Deutsche Bahn ICE train to your university city.',
      localTransferNote: 'Direct ICE high-speed rail from Frankfurt Airport station reaches campus city in 1–2 hours.',
    };
  }
  if (c.includes('toronto')) {
    return {
      airportCode: 'YYZ',
      airportName: 'Toronto Pearson International',
      estimatedOneWayUsd: 780,
      estimatedRoundTripUsd: 1290,
      bookingTip: 'Book 10–12 weeks ahead of Fall orientation; Air Canada & partner student discounts save 10–15%.',
      localTransferNote: 'UP Express train reaches Union Station in 25 minutes (~$9), connecting directly to U of T TTC subway.',
    };
  }
  if (c.includes('montreal')) {
    return {
      airportCode: 'YUL',
      airportName: 'Montreal-Trudeau International',
      estimatedOneWayUsd: 760,
      estimatedRoundTripUsd: 1240,
      bookingTip: 'Arrive 10–14 days early to finalize CAQ/Study Permit activation and banking.',
      localTransferNote: 'STM 747 Express Bus runs 24/7 from YUL to downtown McGill in 35–45 minutes (~$8).',
    };
  }
  if (c.includes('vancouver')) {
    return {
      airportCode: 'YVR',
      airportName: 'Vancouver International Airport',
      estimatedOneWayUsd: 820,
      estimatedRoundTripUsd: 1350,
      bookingTip: 'Asia-Pacific direct routes into YVR offer competitive student baggage allowances.',
      localTransferNote: 'SkyTrain Canada Line + R4 RapidBus takes ~40 minutes directly to UBC Point Grey campus (~$6).',
    };
  }
  if (c.includes('london') || c.includes('oxford') || c.includes('cambridge') && co.includes('united kingdom')) {
    return {
      airportCode: 'LHR',
      airportName: 'London Heathrow Airport',
      estimatedOneWayUsd: 640,
      estimatedRoundTripUsd: 1050,
      bookingTip: 'Look for student fares with free date-change flexibility before UK visa vignette approval.',
      localTransferNote: 'Elizabeth Line / Heathrow Express reaches central London in 20–35 min; coaches run directly to Oxford/Cambridge.',
    };
  }
  if (c.includes('edinburgh')) {
    return {
      airportCode: 'EDI',
      airportName: 'Edinburgh Airport',
      estimatedOneWayUsd: 670,
      estimatedRoundTripUsd: 1090,
      bookingTip: 'Book connecting flights via London or Amsterdam 8 weeks ahead; avoid August Fringe Festival peaks.',
      localTransferNote: 'Edinburgh Tram or Airlink 100 bus reaches city centre & campus in 30 minutes (~$7).',
    };
  }
  if (c.includes('tokyo')) {
    return {
      airportCode: 'HND / NRT',
      airportName: 'Tokyo Haneda / Narita',
      estimatedOneWayUsd: 680,
      estimatedRoundTripUsd: 1120,
      bookingTip: 'Haneda (HND) is much closer to UTokyo Hongo/Komaba campuses than Narita (NRT).',
      localTransferNote: 'Tokyo Monorail + Yamanote Line from Haneda reaches UTokyo area in ~40 minutes (~$6).',
    };
  }
  if (c.includes('kyoto')) {
    return {
      airportCode: 'KIX',
      airportName: 'Kansai International Airport',
      estimatedOneWayUsd: 670,
      estimatedRoundTripUsd: 1100,
      bookingTip: 'Fly directly into Kansai (KIX) to skip Tokyo domestic transfer.',
      localTransferNote: 'JR Haruka Limited Express connects KIX directly to Kyoto Station in 75 minutes (~$22).',
    };
  }
  if (c.includes('seoul') || c.includes('daejeon')) {
    return {
      airportCode: 'ICN',
      airportName: 'Incheon International Airport',
      estimatedOneWayUsd: 650,
      estimatedRoundTripUsd: 1080,
      bookingTip: 'Korean Air & Asiana offer extra student baggage; KAIST/SNU provide pickup buses during orientation.',
      localTransferNote: 'AREX Express reaches Seoul in 43 min; direct express bus from ICN reaches Daejeon (KAIST) in 2.5 hrs (~$20).',
    };
  }
  if (co.includes('singapore')) {
    return {
      airportCode: 'SIN',
      airportName: 'Singapore Changi Airport',
      estimatedOneWayUsd: 540,
      estimatedRoundTripUsd: 890,
      bookingTip: 'Book early for August intake; bring digital IPA (In-Principle Approval) letter for immigration.',
      localTransferNote: 'MRT East-West Line connects Changi directly to NUS/NTU corridors in ~50 minutes (~$2).',
    };
  }
  if (co.includes('hong kong')) {
    return {
      airportCode: 'HKG',
      airportName: 'Hong Kong International Airport',
      estimatedOneWayUsd: 560,
      estimatedRoundTripUsd: 920,
      bookingTip: 'Carry physical visa label affixed to passport before boarding.',
      localTransferNote: 'Airport Express + MTR Island Line reaches HKU Station in 35 minutes (~$15).',
    };
  }
  if (co.includes('australia')) {
    const code = c.includes('sydney') ? 'SYD' : c.includes('canberra') ? 'CBR' : 'MEL';
    return {
      airportCode: code,
      airportName: `${city} Airport (${code})`,
      estimatedOneWayUsd: 790,
      estimatedRoundTripUsd: 1320,
      bookingTip: 'February (Semester 1) and July (Semester 2) intakes book out early; reserve flexible student tickets.',
      localTransferNote: 'Airport rail or SkyBus shuttle connects directly to campus transit hubs in 25–35 minutes (~$15).',
    };
  }
  if (co.includes('united states')) {
    const code = c.includes('stanford') || c.includes('berkeley') ? 'SFO' : c.includes('pittsburgh') ? 'PIT' : 'BOS';
    return {
      airportCode: code,
      airportName: `${city} Regional Hub (${code})`,
      estimatedOneWayUsd: 840,
      estimatedRoundTripUsd: 1390,
      bookingTip: 'F-1 holders may enter the US up to 30 days before the I-20 program start date — never earlier.',
      localTransferNote: 'Campus shuttles, BART/MBTA subway, or regional rail connect airport to university housing (~$5–$18).',
    };
  }

  return {
    airportCode: 'INTL',
    airportName: `${city} International Hub`,
    estimatedOneWayUsd: 650,
    estimatedRoundTripUsd: 1080,
    bookingTip: 'Book 8–10 weeks before orientation with flexible date-change protection pending visa issuance.',
    localTransferNote: `Direct airport rail or express shuttle connects ${city} airport to university district (~$10–$20).`,
  };
}

export function getUniversityGuide(prog: Program): UniversityGuide {
  const co = prog.country.toLowerCase();
  const city = prog.city.toLowerCase();

  let living: LivingExpensesGuide;
  let visa: VisaGuide;

  if (co.includes('switzerland')) {
    const isZurich = city.includes('zurich');
    living = {
      currencyLabel: 'CHF (shown in USD eq.)',
      housingMonthlyUsd: isZurich ? 1050 : 920,
      foodMonthlyUsd: 580,
      transitUtilitiesMonthlyUsd: 190,
      healthInsuranceMonthlyUsd: 130,
      totalMonthlyUsd: isZurich ? 1950 : 1820,
      totalAnnualUsd: (isZurich ? 1950 : 1820) * 12,
      housingTip: 'Apply immediately to WOKO/JUWO (Zurich) or FMEL (Lausanne) student housing upon admission.',
    };
    visa = {
      visaName: 'Swiss National Visa D (Student Residence Permit)',
      visaFeeUsd: 105,
      healthSurchargeUsd: 0,
      proofOfFundsUsd: 24000,
      proofOfFundsNote: 'CHF 21,000 (~$24,000) in a Swiss-recognized bank account required for cantonal migration clearance.',
      processingWeeks: '8–12 weeks',
      embassySteps: [
        'Receive official university admission letter.',
        'Submit Visa D dossier (3 forms, passport, transcripts, CHF 21,000 bank statement) at Swiss Embassy.',
        'Wait for Cantonal Migration Office (Zurich/Vaud) authorization.',
        'Collect entry visa sticker and register at local Einwohnerkontrolle within 14 days of arrival.',
      ],
    };
  } else if (co.includes('germany')) {
    const isMunich = city.includes('munich');
    living = {
      currencyLabel: 'EUR (shown in USD eq.)',
      housingMonthlyUsd: isMunich ? 760 : 540,
      foodMonthlyUsd: 330,
      transitUtilitiesMonthlyUsd: 110,
      healthInsuranceMonthlyUsd: 135,
      totalMonthlyUsd: isMunich ? 1335 : 1115,
      totalAnnualUsd: (isMunich ? 1335 : 1115) * 12,
      housingTip: 'Apply to Studierendenwerk dorms 4–6 months ahead; Deutschlandticket covers regional transit for €49/mo.',
    };
    visa = {
      visaName: 'German National Student Visa (§ 16b AufenthG)',
      visaFeeUsd: 82,
      healthSurchargeUsd: 0,
      proofOfFundsUsd: 12950,
      proofOfFundsNote: 'Mandatory German Blocked Account (Sperrkonto) deposit of €11,904/year (~$12,950).',
      processingWeeks: '4–10 weeks',
      embassySteps: [
        'Complete APS verification (if applicable) and secure university admission letter.',
        'Open German Blocked Account (Expatrio / Coracle / Fintiba) and deposit €11,904.',
        'Arrange incoming travel & statutory German student health insurance (TK / AOK).',
        'Attend German Embassy biometric appointment and collect National D Visa.',
      ],
    };
  } else if (co.includes('canada')) {
    const isHighCost = city.includes('toronto') || city.includes('vancouver');
    living = {
      currencyLabel: 'CAD (shown in USD eq.)',
      housingMonthlyUsd: isHighCost ? 1150 : 880,
      foodMonthlyUsd: 420,
      transitUtilitiesMonthlyUsd: 140,
      healthInsuranceMonthlyUsd: 75,
      totalMonthlyUsd: isHighCost ? 1785 : 1515,
      totalAnnualUsd: (isHighCost ? 1785 : 1515) * 12,
      housingTip: 'On-campus graduate residences fill quickly; shared off-campus leases near subway lines save 25–30%.',
    };
    visa = {
      visaName: 'Canada Study Permit (+ PAL & Biometrics)',
      visaFeeUsd: 110,
      healthSurchargeUsd: 62,
      proofOfFundsUsd: 15100,
      proofOfFundsNote: 'First-year tuition + CAD $20,635 (~$15,100 USD) living funds proof (GIC or liquid bank balance).',
      processingWeeks: '5–10 weeks',
      embassySteps: [
        'Obtain University Letter of Acceptance (LOA) and Provincial Attestation Letter (PAL, if required).',
        'Fund Canadian GIC / liquid proof of funds and complete upfront IRCC medical exam.',
        'Submit IRCC online Study Permit application ($150 CAD fee + $85 CAD biometrics).',
        'Complete biometrics at VAC, receive Port of Entry (POE) Letter & eTA/TRV passport stamp.',
      ],
    };
  } else if (co.includes('united kingdom')) {
    const isLondon = city.includes('london');
    living = {
      currencyLabel: 'GBP (shown in USD eq.)',
      housingMonthlyUsd: isLondon ? 1320 : 890,
      foodMonthlyUsd: 400,
      transitUtilitiesMonthlyUsd: 175,
      healthInsuranceMonthlyUsd: 0,
      totalMonthlyUsd: isLondon ? 1895 : 1465,
      totalAnnualUsd: (isLondon ? 1895 : 1465) * 12,
      housingTip: '18+ Student Oyster photocard saves 30% on London Tube/Bus passes; university halls include utilities.',
    };
    visa = {
      visaName: 'UK Student Route Visa (Tier 4)',
      visaFeeUsd: 625,
      healthSurchargeUsd: 985,
      proofOfFundsUsd: isLondon ? 15200 : 12100,
      proofOfFundsNote: '28-day consecutive bank balance holding unpaid tuition + £1,483/mo London (£1,136/mo outside) for 9 months.',
      processingWeeks: '3–6 weeks',
      embassySteps: [
        'Accept unconditional offer and receive CAS (Confirmation of Acceptance for Studies) number.',
        'Hold tuition balance + 9 months living funds in bank for at least 28 consecutive days.',
        'Apply on GOV.UK, pay £490 visa fee + £776/year Immigration Health Surcharge (IHS).',
        'Complete biometrics/ID check and receive UK eVisa digital immigration status.',
      ],
    };
  } else if (co.includes('united states')) {
    const isCoastal = city.includes('cambridge') || city.includes('stanford') || city.includes('berkeley');
    living = {
      currencyLabel: 'USD',
      housingMonthlyUsd: isCoastal ? 1450 : 980,
      foodMonthlyUsd: 480,
      transitUtilitiesMonthlyUsd: 160,
      healthInsuranceMonthlyUsd: 260,
      totalMonthlyUsd: isCoastal ? 2350 : 1880,
      totalAnnualUsd: (isCoastal ? 2350 : 1880) * 12,
      housingTip: 'Graduate student housing lotteries close early spring; many PhD/MS assistantships waive health insurance.',
    };
    visa = {
      visaName: 'US F-1 Student Visa (I-20 + SEVIS)',
      visaFeeUsd: 185,
      healthSurchargeUsd: 350,
      proofOfFundsUsd: prog.tuitionUsd + (isCoastal ? 26000 : 21000),
      proofOfFundsNote: 'Liquid financial affidavit covering 1 year of tuition + living expenses required to issue Form I-20.',
      processingWeeks: '3–8 weeks',
      embassySteps: [
        'Submit financial documents to receive official Form I-20 from the university.',
        'Pay $350 I-901 SEVIS fee and complete Form DS-160 ($185 MRV fee).',
        'Book and attend US Embassy/Consulate F-1 visa interview with I-20, transcripts & funding proof.',
        'Receive passport with F-1 visa stamp (enter US up to 30 days prior to I-20 start date).',
      ],
    };
  } else if (co.includes('japan')) {
    const isTokyo = city.includes('tokyo');
    living = {
      currencyLabel: 'JPY (shown in USD eq.)',
      housingMonthlyUsd: isTokyo ? 580 : 450,
      foodMonthlyUsd: 340,
      transitUtilitiesMonthlyUsd: 110,
      healthInsuranceMonthlyUsd: 20,
      totalMonthlyUsd: isTokyo ? 1050 : 920,
      totalAnnualUsd: (isTokyo ? 1050 : 920) * 12,
      housingTip: 'University international lodges charge ¥25,000–¥45,000/month — apply within 2 weeks of admission.',
    };
    visa = {
      visaName: 'Japan Student Visa (Certificate of Eligibility)',
      visaFeeUsd: 30,
      healthSurchargeUsd: 0,
      proofOfFundsUsd: 13500,
      proofOfFundsNote: 'Bank balance or scholarship certificate (~¥2,000,000 / $13,500) needed for COE sponsorship.',
      processingWeeks: '6–10 weeks',
      embassySteps: [
        'University applies on your behalf for the Certificate of Eligibility (COE) in Japan.',
        'Receive digital/physical COE from university admissions office.',
        'Submit passport, COE, and visa form to Japanese Embassy/Consulate.',
        'Enroll in Japan National Health Insurance at ward office upon landing (~$20/month).',
      ],
    };
  } else if (co.includes('korea')) {
    living = {
      currencyLabel: 'KRW (shown in USD eq.)',
      housingMonthlyUsd: 420,
      foodMonthlyUsd: 340,
      transitUtilitiesMonthlyUsd: 85,
      healthInsuranceMonthlyUsd: 55,
      totalMonthlyUsd: 900,
      totalAnnualUsd: 10800,
      housingTip: 'KAIST & SNU on-campus dormitories are heavily subsidized (~$250–$400/mo including utilities).',
    };
    visa = {
      visaName: 'South Korea D-2 Student Visa',
      visaFeeUsd: 60,
      healthSurchargeUsd: 0,
      proofOfFundsUsd: 14500,
      proofOfFundsNote: 'Certificate of Admission + $10,000–$20,000 bank statement (waived for full scholarship recipients).',
      processingWeeks: '2–5 weeks',
      embassySteps: [
        'Receive Standard Admission Letter & business registration copy from university.',
        'Apostille/consular-verify prior degree certificate & transcripts.',
        'Submit D-2 visa application at Korean Embassy or Visa Application Center.',
        'Apply for Alien Registration Card (ARC) within 90 days of arrival.',
      ],
    };
  } else if (co.includes('australia')) {
    const isSydney = city.includes('sydney');
    living = {
      currencyLabel: 'AUD (shown in USD eq.)',
      housingMonthlyUsd: isSydney ? 1200 : 980,
      foodMonthlyUsd: 410,
      transitUtilitiesMonthlyUsd: 150,
      healthInsuranceMonthlyUsd: 55,
      totalMonthlyUsd: isSydney ? 1815 : 1595,
      totalAnnualUsd: (isSydney ? 1815 : 1595) * 12,
      housingTip: 'Purpose-built student housing or shared suburbs near rail stations reduce commute and rent by 20%.',
    };
    visa = {
      visaName: 'Australia Subclass 500 Student Visa',
      visaFeeUsd: 1050,
      healthSurchargeUsd: 520,
      proofOfFundsUsd: 19600,
      proofOfFundsNote: 'AUD $29,710 (~$19,600 USD) annual living capacity + first-year tuition + Overseas Student Health Cover (OSHC).',
      processingWeeks: '4–8 weeks',
      embassySteps: [
        'Accept offer, pay deposit & mandatory OSHC policy to receive Confirmation of Enrolment (CoE).',
        'Draft Genuine Student (GS) statement and compile financial capacity evidence.',
        'Lodge Subclass 500 visa in ImmiAccount ($1,600 AUD fee) and complete panel health exam.',
        'Receive electronic Visa Grant Notice before booking non-refundable travel.',
      ],
    };
  } else if (co.includes('singapore') || co.includes('hong kong')) {
    const isSg = co.includes('singapore');
    living = {
      currencyLabel: isSg ? 'SGD (shown in USD eq.)' : 'HKD (shown in USD eq.)',
      housingMonthlyUsd: isSg ? 820 : 900,
      foodMonthlyUsd: 380,
      transitUtilitiesMonthlyUsd: 105,
      healthInsuranceMonthlyUsd: 40,
      totalMonthlyUsd: isSg ? 1345 : 1425,
      totalAnnualUsd: (isSg ? 1345 : 1425) * 12,
      housingTip: 'Hawker centers / university canteens keep nutritious meals affordable (~$4–$7 per meal).',
    };
    visa = {
      visaName: isSg ? 'Singapore Student Pass (ICA SOLAR)' : 'Hong Kong Student Visa Entry Permit',
      visaFeeUsd: isSg ? 68 : 45,
      healthSurchargeUsd: 0,
      proofOfFundsUsd: 14000,
      proofOfFundsNote: 'University sponsors visa application; proof of tuition + living support required prior to issuance.',
      processingWeeks: '3–6 weeks',
      embassySteps: [
        isSg
          ? 'Submit eForm 16 via ICA SOLAR system once university registers your offer.'
          : 'Mail/upload visa sponsorship forms and financial proof to university Global Office.',
        'Receive In-Principle Approval (IPA) or physical entry permit label.',
        'Complete mandatory arrival medical screening (if required) and collect Student Pass / HKID.',
      ],
    };
  } else {
    // Netherlands, Sweden, Denmark, France, Italy, Belgium & other Europe
    const isNordic = co.includes('sweden') || co.includes('denmark');
    living = {
      currencyLabel: 'EUR (shown in USD eq.)',
      housingMonthlyUsd: isNordic ? 720 : 650,
      foodMonthlyUsd: 340,
      transitUtilitiesMonthlyUsd: 120,
      healthInsuranceMonthlyUsd: 65,
      totalMonthlyUsd: isNordic ? 1245 : 1175,
      totalAnnualUsd: (isNordic ? 1245 : 1175) * 12,
      housingTip: 'Join university housing queues immediately upon application — European student rooms allocate first-come.',
    };
    visa = {
      visaName: `${prog.country} Long-Stay Student Residence Permit`,
      visaFeeUsd: 195,
      healthSurchargeUsd: 0,
      proofOfFundsUsd: 12800,
      proofOfFundsNote: `Official proof of ~€10,500–€12,500 annual living support required by ${prog.country} immigration.`,
      processingWeeks: '4–9 weeks',
      embassySteps: [
        'Accept offer and pay initial tuition deposit or administrative fee.',
        `Submit student residence permit dossier via ${prog.country} immigration portal / embassy.`,
        'Complete biometrics at embassy or upon arrival to collect EU residence permit card.',
      ],
    };
  }

  const airTicket = getAirportForCity(prog.city, prog.country);
  const firstYearTotalUsd =
    prog.tuitionUsd + living.totalAnnualUsd + visa.visaFeeUsd + visa.healthSurchargeUsd + airTicket.estimatedOneWayUsd;

  const steps: JourneyStep[] = [
    {
      id: 'step_1_docs',
      stepNumber: 1,
      phase: 'Preparation',
      title: 'Verify Eligibility & Encrypt Required Documents',
      description: `Confirm GPA (${prog.minGpaRecommended?.toFixed(2) ?? '3.30'}+ target) and language score (${prog.language}), then prepare transcripts, SOP, recommendation letters, and passport in your E2EE Vault.`,
      timelineHint: '6–10 weeks before deadline',
    },
    {
      id: 'step_2_apply',
      stepNumber: 2,
      phase: 'Admissions',
      title: `Submit Application & Fee ($${prog.applicationFeeUsd}) to ${prog.university}`,
      description: `Apply via ${prog.university}'s official admissions portal or directly through StudyGlobe before ${prog.deadline}.`,
      timelineHint: `Before ${prog.deadline}`,
    },
    {
      id: 'step_3_funding',
      stepNumber: 3,
      phase: 'Scholarships & Offer',
      title: 'Apply for Scholarships & Confirm Tuition Deposit',
      description: `Upon receiving your Offer Letter, submit matching national/university scholarship forms and confirm seat deposit toward $${prog.tuitionUsd.toLocaleString()}/yr tuition.`,
      timelineHint: '2–6 weeks post-offer',
    },
    {
      id: 'step_4_funds',
      stepNumber: 4,
      phase: 'Financial Clearance',
      title: `Arrange Proof of Funds (~$${visa.proofOfFundsUsd.toLocaleString()})`,
      description: visa.proofOfFundsNote,
      timelineHint: 'Immediately after offer acceptance',
    },
    {
      id: 'step_5_visa',
      stepNumber: 5,
      phase: 'Visa & Immigration',
      title: `Apply for ${visa.visaName}`,
      description: `Pay visa fee ($${visa.visaFeeUsd}${visa.healthSurchargeUsd > 0 ? ` + $${visa.healthSurchargeUsd} health/SEVIS surcharge` : ''}), complete biometrics/interview, and track processing (${visa.processingWeeks}).`,
      timelineHint: '8–12 weeks before travel',
    },
    {
      id: 'step_6_flight',
      stepNumber: 6,
      phase: 'Air Ticket & Housing',
      title: `Book Flight to ${airTicket.airportCode} (~$${airTicket.estimatedOneWayUsd} one-way) & Reserve Dorm`,
      description: `${airTicket.bookingTip} ${living.housingTip}`,
      timelineHint: '4–8 weeks before orientation',
    },
    {
      id: 'step_7_arrive',
      stepNumber: 7,
      phase: 'Arrival & Setup',
      title: `Land at ${airTicket.airportCode}, Register City Address & Campus ID`,
      description: `${airTicket.localTransferNote} Complete municipal/immigration registration, open local bank account, and activate student health coverage.`,
      timelineHint: 'First 14 days in country',
    },
  ];

  return {
    living,
    visa,
    airTicket,
    firstYearTotalUsd,
    steps,
  };
}
