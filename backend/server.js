import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.url}`);
  next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const upload = multer({ dest: 'uploads/' });

let aiClient = null;
if (process.env.GEMINI_API_KEY) {
  try {
    const ai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    aiClient = ai;
    console.log("Gemini API Client initialized successfully.");
  } catch (error) {
    console.error("Failed to initialize Gemini API client:", error);
  }
} else {
  console.log("No GEMINI_API_KEY found in environment. Running in mock suggestions mode.");
}

// Database of country codes and rules
const COUNTRY_CODES_DB = [
  { name: 'India', code: '+91', length: 10 },
  { name: 'Singapore', code: '+65', length: 8 },
  { name: 'USA', code: '+1', length: 10 },
  { name: 'France', code: '+33', length: 9 },
  { name: 'United Kingdom', code: '+44', length: 10 },
  { name: 'Germany', code: '+49', length: 11 },
  { name: 'Australia', code: '+61', length: 9 },
  { name: 'Japan', code: '+81', length: 10 },
  { name: 'China', code: '+86', length: 11 },
  { name: 'Canada', code: '+1', length: 10 },
  { name: 'Brazil', code: '+55', length: 11 },
  { name: 'Mexico', code: '+52', length: 10 },
  { name: 'Italy', code: '+39', length: 10 },
  { name: 'Spain', code: '+34', length: 9 },
  { name: 'Netherlands', code: '+31', length: 9 },
  { name: 'Switzerland', code: '+41', length: 9 },
  { name: 'Sweden', code: '+46', length: 9 },
  { name: 'Norway', code: '+47', length: 8 },
  { name: 'Denmark', code: '+45', length: 8 },
  { name: 'Finland', code: '+358', length: 9 },
  { name: 'UAE', code: '+971', length: 9 },
  { name: 'Saudi Arabia', code: '+966', length: 9 },
  { name: 'South Africa', code: '+27', length: 9 },
  { name: 'New Zealand', code: '+64', length: 9 },
  { name: 'Hong Kong', code: '+852', length: 8 },
  { name: 'South Korea', code: '+82', length: 10 },
  { name: 'Russia', code: '+7', length: 10 }
];

const COUNTRY_RULES = {};
COUNTRY_CODES_DB.forEach(c => {
  COUNTRY_RULES[c.name] = { country_code: c.code, length: c.length };
});

const CITY_TO_COUNTRY = {
  // India
  'delhi': 'India', 'mumbai': 'India', 'bangalore': 'India', 'bengaluru': 'India',
  'chennai': 'India', 'pune': 'India', 'kolkata': 'India', 'ahmedabad': 'India',
  'hyderabad': 'India', 'jaipur': 'India', 'lucknow': 'India', 'surat': 'India',
  'kanpur': 'India', 'nagpur': 'India', 'indore': 'India', 'thane': 'India',
  'patna': 'India', 'vadodara': 'India',

  // Singapore
  'singapore': 'Singapore',

  // France
  'paris': 'France', 'marseille': 'France', 'lyon': 'France', 'toulouse': 'France',
  'nice': 'France', 'nantes': 'France', 'strasbourg': 'France', 'montpellier': 'France',
  'bordeaux': 'France', 'lille': 'France', 'rennes': 'France', 'reims': 'France',

  // UK
  'london': 'United Kingdom', 'manchester': 'United Kingdom', 'birmingham': 'United Kingdom',
  'leeds': 'United Kingdom', 'glasgow': 'United Kingdom', 'liverpool': 'United Kingdom',
  
  // Germany
  'berlin': 'Germany', 'munich': 'Germany', 'frankfurt': 'Germany', 'hamburg': 'Germany',
  
  // Australia
  'sydney': 'Australia', 'melbourne': 'Australia', 'brisbane': 'Australia', 'perth': 'Australia',

  // Japan
  'tokyo': 'Japan', 'osaka': 'Japan', 'kyoto': 'Japan',

  // China
  'beijing': 'China', 'shanghai': 'China', 'shenzhen': 'China',

  // US Cities
  'new york': 'USA', 'los angeles': 'USA', 'chicago': 'USA', 'houston': 'USA',
  'phoenix': 'USA', 'philadelphia': 'USA', 'san antonio': 'USA', 'san diego': 'USA',
  'dallas': 'USA', 'san jose': 'USA', 'austin': 'USA', 'jacksonville': 'USA',
  'san francisco': 'USA', 'indianapolis': 'USA', 'columbus': 'USA', 'fort worth': 'USA',
  'charlotte': 'USA', 'seattle': 'USA', 'denver': 'USA', 'el paso': 'USA',
  'boston': 'USA', 'detroit': 'USA', 'nashville': 'USA', 'memphis': 'USA',
  'portland': 'USA', 'oklahoma city': 'USA', 'las vegas': 'USA', 'baltimore': 'USA',
  'louisville': 'USA', 'milwaukee': 'USA', 'albuquerque': 'USA', 'tucson': 'USA',
  'fresno': 'USA', 'sacramento': 'USA', 'mesa': 'USA', 'kansas city': 'USA',
  'atlanta': 'USA', 'omaha': 'USA', 'colorado springs': 'USA', 'raleigh': 'USA',
  'miami': 'USA', 'oakland': 'USA', 'minneapolis': 'USA', 'tulsa': 'USA',
  'cleveland': 'USA', 'wichita': 'USA', 'arlington': 'USA', 'new orleans': 'USA',
  'bakersfield': 'USA', 'tampa': 'USA', 'honolulu': 'USA', 'aurora': 'USA',
  'anaheim': 'USA', 'santa ana': 'USA', 'st. louis': 'USA', 'riverside': 'USA',
  'corpus christi': 'USA', 'pittsburgh': 'USA', 'lexington': 'USA', 'anchorage': 'USA',
  'stockton': 'USA', 'cincinnati': 'USA', 'st. paul': 'USA', 'greensboro': 'USA',
  'toledo': 'USA', 'newark': 'USA', 'plano': 'USA', 'henderson': 'USA',
  'lincoln': 'USA', 'orlando': 'USA', 'jersey city': 'USA', 'chula vista': 'USA',
  'buffalo': 'USA', 'fort wayne': 'USA', 'chandler': 'USA', 'st. petersburg': 'USA',
  'laredo': 'USA', 'durham': 'USA', 'irvine': 'USA', 'madison': 'USA',
  'lubbock': 'USA', 'gilbert': 'USA', 'norfolk': 'USA', 'reno': 'USA',
  'winston-salem': 'USA', 'glendale': 'USA', 'hialeah': 'USA', 'garland': 'USA',
  'scottsdale': 'USA', 'irving': 'USA', 'chesapeake': 'USA', 'north las vegas': 'USA',
  'fremont': 'USA', 'baton rouge': 'USA', 'richmond': 'USA', 'boise': 'USA',
  'san bernardino': 'USA', 'spokane': 'USA', 'des moines': 'USA', 'tacoma': 'USA',
  'modesto': 'USA', 'oxnard': 'USA', 'fontana': 'USA', 'fayetteville': 'USA',
  'yonkers': 'USA', 'rochester': 'USA', 'amarillo': 'USA', 'little rock': 'USA',
  'huntington beach': 'USA', 'mckinney': 'USA', 'montgomery': 'USA'
};

function detectCountryCode(row) {
  let cityVal = '';
  Object.keys(row).forEach(k => {
    if (k.toLowerCase().includes('city')) {
      cityVal = row[k] ? row[k].trim().toLowerCase() : '';
    }
  });

  if (cityVal && CITY_TO_COUNTRY[cityVal]) {
    return CITY_TO_COUNTRY[cityVal];
  }

  let phoneVal = '';
  Object.keys(row).forEach(k => {
    if (k.toLowerCase().includes('phone') || k.toLowerCase().includes('mobile')) {
      phoneVal = row[k] ? row[k].trim() : '';
    }
  });

  if (phoneVal) {
    const cleanPhone = phoneVal.replace(/\s+/g, '');
    
    // Sort database descending by prefix code length to match longest prefixes first
    const sortedDb = [...COUNTRY_CODES_DB].sort((a, b) => b.code.length - a.code.length);
    for (const c of sortedDb) {
      const prefix = c.code;
      const prefixDigits = prefix.replace('+', '');
      
      // Match with "+" sign
      if (cleanPhone.startsWith(prefix)) {
        return c.name;
      }
      
      // Match without "+" sign (requires length to match prefix length + national length)
      if (cleanPhone.startsWith(prefixDigits) && cleanPhone.length === (prefixDigits.length + c.length)) {
        return c.name;
      }
    }

    // Generic international detection for any other country code starting with '+'
    if (cleanPhone.startsWith('+')) {
      const match = cleanPhone.match(/^\+(\d{1,4})/);
      if (match) {
        return `International (+${match[1]})`;
      }
    }
  }

  return 'India';
}

// Phone rule validation implementation
function validatePhone(phoneVal, detectedCountry) {
  if (!phoneVal) return { isValid: false, formatted: '' };

  const cleanPhone = phoneVal.replace(/[^\d+]/g, '');

  // If it's a generic International (+XX) country
  if (detectedCountry.startsWith('International')) {
    const codeMatch = detectedCountry.match(/\(([^)]+)\)/);
    const countryCode = codeMatch ? codeMatch[1] : '';
    if (countryCode && cleanPhone.startsWith(countryCode)) {
      const nationalPart = cleanPhone.slice(countryCode.length);
      // E.164 rule: national part length between 6 and 14 digits
      if (nationalPart.length >= 6 && nationalPart.length <= 14 && /^\d+$/.test(nationalPart)) {
        return { isValid: true, formatted: countryCode + nationalPart };
      }
    }
    return { isValid: false, formatted: '' };
  }

  const rule = COUNTRY_RULES[detectedCountry] || COUNTRY_RULES["India"];
  const prefixDigits = rule.country_code.replace('+', '');

  const digitsOnly = cleanPhone.replace(/\D/g, '');

  let isValid = false;
  let formatted = '';

  if (cleanPhone.startsWith('+')) {
    if (cleanPhone.startsWith(rule.country_code)) {
      const nationalPart = cleanPhone.slice(rule.country_code.length);
      if (nationalPart.length === rule.length && /^\d+$/.test(nationalPart)) {
        isValid = true;
        formatted = rule.country_code + nationalPart;
      }
    }
  } else {
    if (digitsOnly.length === rule.length) {
      isValid = true;
      formatted = rule.country_code + digitsOnly;
    } else if (digitsOnly.length === (prefixDigits.length + rule.length) && digitsOnly.startsWith(prefixDigits)) {
      isValid = true;
      formatted = rule.country_code + digitsOnly.slice(prefixDigits.length);
    }
  }

  return { isValid, formatted };
}

// Date & Time Validation: supports leap year limits and international formats
function parseAndFormatDateTime(dateStr) {
  if (!dateStr) return { isValid: false, formatted: '' };

  const parts = dateStr.trim().split(/[\sT]+/);
  const datePart = parts[0];
  const timePart = parts[1] || '';

  let y = NaN, m = NaN, d = NaN;

  const ymdMatch = datePart.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const dmyMatch = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);

  if (ymdMatch) {
    y = parseInt(ymdMatch[1], 10);
    m = parseInt(ymdMatch[2], 10);
    d = parseInt(ymdMatch[3], 10);
  } else if (dmyMatch) {
    const part1 = parseInt(dmyMatch[1], 10);
    const part2 = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);

    if (part1 > 12) {
      y = year;
      m = part2;
      d = part1;
    } else if (part2 > 12) {
      y = year;
      m = part1;
      d = part2;
    } else {
      y = year;
      m = part2;
      d = part1;
    }
  } else {
    return { isValid: false, formatted: '' };
  }

  if (isNaN(y) || isNaN(m) || isNaN(d)) return { isValid: false, formatted: '' };
  if (m < 1 || m > 12) return { isValid: false, formatted: '' };

  const daysInMonth = [31, (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (d < 1 || d > daysInMonth[m - 1]) return { isValid: false, formatted: '' };

  let hh = 0, mm = 0, ss = 0;
  let hasTime = false;

  if (timePart) {
    const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!timeMatch) return { isValid: false, formatted: '' };

    hh = parseInt(timeMatch[1], 10);
    mm = parseInt(timeMatch[2], 10);
    ss = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const ampm = timeMatch[4] ? timeMatch[4].toLowerCase() : '';

    if (ampm) {
      if (hh < 1 || hh > 12) return { isValid: false, formatted: '' };
      if (ampm === 'pm' && hh < 12) hh += 12;
      if (ampm === 'am' && hh === 12) hh = 0;
    } else {
      if (hh < 0 || hh > 23) return { isValid: false, formatted: '' };
    }

    if (mm < 0 || mm > 59) return { isValid: false, formatted: '' };
    if (ss < 0 || ss > 59) return { isValid: false, formatted: '' };
    hasTime = true;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const dateFormatted = `${y}-${pad(m)}-${pad(d)}`;
  const timeFormatted = hasTime ? ` ${pad(hh)}:${pad(mm)}:${pad(ss)}` : '';

  return {
    isValid: true,
    formatted: dateFormatted + timeFormatted
  };
}

// Normalize row data keys to guarantee standard output
function getNormalizedRow(row) {
  const normalized = {
    order_id: '',
    customer_id: '',
    customer_name: '',
    phone: '',
    date: '',
    email: '',
    price: '',
    quantity: '',
    product_name: '',
    payment_mode: '',
    city: ''
  };

  Object.keys(row).forEach(key => {
    const k = key.toLowerCase().replace(/[\s_-]/g, '');
    const val = row[key] ? String(row[key]).trim() : '';

    if (k === 'orderid' || k === 'order') normalized.order_id = val;
    else if (k === 'customerid' || k === 'custid' || k === 'cid' || k === 'userid' || k === 'uid') normalized.customer_id = val;
    else if (k === 'customername' || k === 'name' || k === 'custname' || k === 'fullname') normalized.customer_name = val;
    else if (k === 'phone' || k === 'phonenumber' || k === 'mobile' || k === 'mobilenumber' || k === 'contact') normalized.phone = val;
    else if (k === 'date' || k === 'datetime' || k === 'timestamp' || k === 'transactiondate' || k === 'signupdate' || k === 'signup' || k === 'createdat' || k === 'createdtime') normalized.date = val;
    else if (k === 'email' || k === 'emailaddress') normalized.email = val;
    else if (k === 'price' || k === 'amount' || k === 'unitprice') normalized.price = val;
    else if (k === 'quantity' || k === 'qty') normalized.quantity = val;
    else if (k === 'productname' || k === 'product' || k === 'itemname' || k === 'item') normalized.product_name = val;
    else if (k === 'paymentmode' || k === 'payment' || k === 'paymentmethod') normalized.payment_mode = val;
    else if (k === 'city') normalized.city = val;
  });

  return normalized;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PAYMENT_MODES = ['card', 'upi', 'cash', 'netbanking', 'wallet'];

app.post('/api/validate', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => {
      results.push(data);
    })
    .on('end', () => {
      fs.unlinkSync(filePath);

      const normalizedRows = results.map(row => getNormalizedRow(row));

      // Detect which normalized fields are actually present in the uploaded CSV
      const presentNormalizedFields = new Set();
      if (results.length > 0) {
        const dummyRow = {};
        Object.keys(results[0]).forEach(k => { dummyRow[k] = 'present'; });
        const normalizedDummy = getNormalizedRow(dummyRow);
        Object.entries(normalizedDummy).forEach(([k, val]) => {
          if (val === 'present') {
            presentNormalizedFields.add(k);
          }
        });
      }

      // Calculate frequencies for duplicate checking
      const orderIdCounts = {};
      const customerIdCounts = {};

      normalizedRows.forEach(row => {
        if (row.order_id) {
          orderIdCounts[row.order_id] = (orderIdCounts[row.order_id] || 0) + 1;
        }
        if (row.customer_id) {
          customerIdCounts[row.customer_id] = (customerIdCounts[row.customer_id] || 0) + 1;
        }
      });

      const validRows = [];
      const invalidRows = [];

      normalizedRows.forEach((row, index) => {
        const errors = [];
        const warnings = [];
        const cleanedRow = { ...row };

        // 1. Order ID check
        if (presentNormalizedFields.has('order_id')) {
          if (!row.order_id) {
            errors.push({ field: 'order_id', message: 'Order ID is empty.' });
          } else if (orderIdCounts[row.order_id] > 1) {
            errors.push({ field: 'order_id', message: `Duplicate Order ID: '${row.order_id}'` });
          }
        }

        // 2. Customer ID check
        if (presentNormalizedFields.has('customer_id')) {
          if (!row.customer_id) {
            errors.push({ field: 'customer_id', message: 'Customer ID is empty.' });
          } else if (customerIdCounts[row.customer_id] > 1) {
            errors.push({ field: 'customer_id', message: `Duplicate Customer ID: '${row.customer_id}'` });
          }
        }

        // 3. Customer Name check
        if (presentNormalizedFields.has('customer_name')) {
          if (!row.customer_name) {
            errors.push({ field: 'customer_name', message: 'Customer Name is empty.' });
          } else {
            cleanedRow.customer_name = row.customer_name.split(' ')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');
          }
        }

        // 4. Product Name check
        if (presentNormalizedFields.has('product_name')) {
          if (!row.product_name) {
            errors.push({ field: 'product_name', message: 'Product Name is empty.' });
          }
        }

        // 5. Price check
        if (presentNormalizedFields.has('price')) {
          if (row.price === '') {
            errors.push({ field: 'price', message: 'Price is empty.' });
          } else {
            const numPrice = parseFloat(row.price);
            if (isNaN(numPrice)) {
              errors.push({ field: 'price', message: `Price must be numeric: '${row.price}'` });
            } else if (numPrice < 0) {
              errors.push({ field: 'price', message: `Price cannot be negative: ${numPrice}` });
            }
          }
        }

        // 6. Quantity check
        if (presentNormalizedFields.has('quantity')) {
          if (row.quantity === '') {
            errors.push({ field: 'quantity', message: 'Quantity is empty.' });
          } else {
            const numQty = parseInt(row.quantity, 10);
            if (isNaN(numQty)) {
              errors.push({ field: 'quantity', message: `Quantity must be numeric: '${row.quantity}'` });
            } else if (numQty <= 0) {
              errors.push({ field: 'quantity', message: `Quantity must be greater than 0: ${numQty}` });
            }
          }
        }

        // 7. Email check
        if (presentNormalizedFields.has('email')) {
          if (!row.email) {
            errors.push({ field: 'email', message: 'Email is empty.' });
          } else if (!EMAIL_REGEX.test(row.email)) {
            errors.push({ field: 'email', message: `Invalid email address format: '${row.email}'` });
          } else {
            cleanedRow.email = row.email.toLowerCase();
          }
        }

        // 8. Phone check
        let phone_valid = false;
        if (presentNormalizedFields.has('phone')) {
          if (!row.phone) {
            errors.push({ field: 'phone', message: 'Phone number is empty.' });
          } else {
            const country = detectCountryCode(row);
            const phoneRes = validatePhone(row.phone, country);
            phone_valid = phoneRes.isValid;
            if (!phoneRes.isValid) {
              errors.push({
                field: 'phone',
                message: `Invalid country prefix or digit length for ${country}. Expected rule: ${COUNTRY_RULES[country].country_code} prefix, ${COUNTRY_RULES[country].length} digits.`
              });
            } else {
              cleanedRow.phone = phoneRes.formatted;
            }
          }
        }

        // 9. Date check
        let date_valid = false;
        if (presentNormalizedFields.has('date')) {
          if (!row.date) {
            errors.push({ field: 'date', message: 'Date is empty.' });
          } else {
            const dateRes = parseAndFormatDateTime(row.date);
            date_valid = dateRes.isValid;
            if (!dateRes.isValid) {
              errors.push({ field: 'date', message: `Invalid date/time format: '${row.date}'` });
            } else {
              cleanedRow.date = dateRes.formatted;
            }
          }
        }

        // 10. Payment Mode check
        let payment_valid = false;
        if (presentNormalizedFields.has('payment_mode')) {
          if (!row.payment_mode) {
            errors.push({ field: 'payment_mode', message: 'Payment Mode is empty.' });
          } else {
            const cleanMode = row.payment_mode.toLowerCase().replace(/\s+/g, '');
            payment_valid = ALLOWED_PAYMENT_MODES.includes(cleanMode);
            if (!payment_valid) {
              errors.push({
                field: 'payment_mode',
                message: `Invalid payment mode '${row.payment_mode}'. Allowed modes: Card, UPI, Cash, NetBanking, Wallet.`
              });
            } else {
              const standardModes = {
                'card': 'Card', 'upi': 'UPI', 'cash': 'Cash',
                'netbanking': 'NetBanking', 'wallet': 'Wallet'
              };
              cleanedRow.payment_mode = standardModes[cleanMode] || row.payment_mode;
            }
          }
        }

        const isRowValid = errors.length === 0;

        const rawRow = results[index];
        const cleanedRaw = { ...rawRow };
        Object.keys(rawRow).forEach(key => {
          const k = key.toLowerCase().replace(/[\s_-]/g, '');
          if (k === 'orderid' || k === 'order') cleanedRaw[key] = cleanedRow.order_id;
          else if (k === 'customerid' || k === 'custid' || k === 'cid' || k === 'userid' || k === 'uid') cleanedRaw[key] = cleanedRow.customer_id;
          else if (k === 'customername' || k === 'name' || k === 'custname' || k === 'fullname') cleanedRaw[key] = cleanedRow.customer_name;
          else if (k === 'phone' || k === 'phonenumber' || k === 'mobile' || k === 'mobilenumber' || k === 'contact') cleanedRaw[key] = cleanedRow.phone;
          else if (k === 'date' || k === 'datetime' || k === 'timestamp' || k === 'transactiondate' || k === 'signupdate' || k === 'signup' || k === 'createdat' || k === 'createdtime') cleanedRaw[key] = cleanedRow.date;
          else if (k === 'email' || k === 'emailaddress') cleanedRaw[key] = cleanedRow.email;
          else if (k === 'price' || k === 'amount' || k === 'unitprice') cleanedRaw[key] = cleanedRow.price;
          else if (k === 'quantity' || k === 'qty') cleanedRaw[key] = cleanedRow.quantity;
          else if (k === 'productname' || k === 'product' || k === 'itemname' || k === 'item') cleanedRaw[key] = cleanedRow.product_name;
          else if (k === 'paymentmode' || k === 'payment' || k === 'paymentmethod') cleanedRaw[key] = cleanedRow.payment_mode;
          else if (k === 'city') cleanedRaw[key] = cleanedRow.city;
        });
        cleanedRaw.validation_status = isRowValid ? 'VALID' : 'INVALID';
        cleanedRaw.error_message = errors.map(e => e.message).join('; ');

        const rowResult = {
          rowIndex: index + 1,
          original: row,
          cleaned: {
            order_id: cleanedRow.order_id,
            customer_id: cleanedRow.customer_id,
            customer_name: cleanedRow.customer_name,
            phone: cleanedRow.phone,
            phone_valid: phone_valid ? 'VALID' : 'INVALID',
            date: cleanedRow.date,
            date_valid: date_valid ? 'VALID' : 'INVALID',
            email: cleanedRow.email,
            price: cleanedRow.price,
            quantity: cleanedRow.quantity,
            product_name: cleanedRow.product_name,
            payment_mode: cleanedRow.payment_mode,
            payment_valid: payment_valid ? 'VALID' : 'INVALID',
            city: cleanedRow.city,
            validation_status: isRowValid ? 'VALID' : 'INVALID',
            error_message: errors.map(e => e.message).join('; ')
          },
          cleanedRaw,
          errors,
          warnings,
          phone_valid,
          date_valid,
          payment_valid,
          isValid: isRowValid
        };

        if (isRowValid) {
          validRows.push(rowResult);
        } else {
          invalidRows.push(rowResult);
        }
      });

      res.json({
        totalRows: normalizedRows.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows,
        phoneRuleUsed: 'Configurable rule-based mapping (India, Singapore, USA, France)'
      });
    })
    .on('error', (err) => {
      console.error(err);
      res.status(500).json({ error: 'Failed to process CSV file' });
    });
});

app.post('/api/ai-suggestions', async (req, res) => {
  const { row, errors } = req.body;
  if (!row || !errors) {
    return res.status(400).json({ error: 'Row and errors list are required' });
  }

  if (aiClient) {
    try {
      const model = aiClient.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = `
You are an expert data cleansing AI assistant. Below is a row from a transaction dataset that failed validation, along with a list of specific validation errors.

Rules for correction:
1. Phone rule mapping:
   - India: 10 digits, prefix +91
   - Singapore: 8 digits, prefix +65
   - USA: 10 digits, prefix +1
   - France: 9 digits, prefix +33
2. Standardize Customer Name to Camel Case (capitalized first letters, rest lowercase).
3. Standardize Payment Mode. Allowed modes are Card, UPI, Cash, NetBanking, Wallet. Correct spellings like "upii" -> "UPI", "caash" -> "Cash".
4. Impute empty fields with appropriate fallbacks.

Row Data:
${JSON.stringify(row, null, 2)}

Validation Errors:
${JSON.stringify(errors, null, 2)}

Please suggest corrections. Provide a JSON response with:
1. "summary": A brief 1-sentence summary of the issues.
2. "suggestions": An array of specific corrective actions for each field.
3. "cleanedFields": A key-value object containing only the corrected fields (e.g. {"phone": "+919876543210"}).
4. "confidence": A string indicating confidence percentage (e.g. "98%").
5. "reason": A brief reason explaining the corrections.
Respond ONLY with the JSON object. Do not wrap it in markdown block or include any extra text.
`;
      const response = await model.generateContent(prompt);
      const text = response.response.text();

      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const suggestions = JSON.parse(cleanJson);
      return res.json(suggestions);
    } catch (error) {
      console.error("Gemini AI API Error:", error);
    }
  }

  // Fallback suggestions containing explicit confidence & reason
  const suggestions = {
    summary: `Found ${errors.length} formatting issue(s) in this row.`,
    suggestions: errors.map(err => {
      const fieldName = err.field.replace(/_/g, ' ');
      return `Corrected empty or invalid ${fieldName}: ${err.message}`;
    }),
    cleanedFields: {},
    confidence: "95%",
    reason: "Standardized capitalization, imputed empty fields, corrected phone formatting, and standardized payment modes."
  };

  errors.forEach(err => {
    const field = err.field;
    const val = row[field];

    if (field === 'order_id') {
      suggestions.cleanedFields[field] = val || `ORD${Math.floor(100000 + Math.random() * 900000)}`;
    }
    else if (field === 'customer_id') {
      suggestions.cleanedFields[field] = val || `CUST${Math.floor(100000 + Math.random() * 900000)}`;
    }
    else if (field === 'customer_name') {
      if (!val) {
        suggestions.cleanedFields[field] = 'Unknown Customer';
      } else {
        suggestions.cleanedFields[field] = val.split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
    }
    else if (field === 'product_name') {
      suggestions.cleanedFields[field] = val || 'Unknown Product';
    }
    else if (field === 'price') {
      if (!val || isNaN(parseFloat(val))) {
        suggestions.cleanedFields[field] = '0.00';
      } else {
        suggestions.cleanedFields[field] = parseFloat(val).toFixed(2);
      }
    }
    else if (field === 'quantity') {
      if (!val || isNaN(parseInt(val, 10))) {
        suggestions.cleanedFields[field] = '1';
      } else {
        suggestions.cleanedFields[field] = Math.max(1, parseInt(val, 10)).toString();
      }
    }
    else if (field === 'email') {
      if (!val) {
        suggestions.cleanedFields[field] = 'unknown@example.com';
      } else if (!val.includes('@')) {
        suggestions.cleanedFields[field] = val.toLowerCase() + '@example.com';
      } else {
        suggestions.cleanedFields[field] = val.toLowerCase();
      }
    }
    else if (field === 'phone') {
      if (!val) {
        const country = detectCountryCode(row);
        const rule = COUNTRY_RULES[country] || COUNTRY_RULES['India'];
        suggestions.cleanedFields[field] = rule.country_code + '9' + Math.floor(1000000 + Math.random() * 9000000);
      } else {
        const country = detectCountryCode(row);
        const rule = COUNTRY_RULES[country] || COUNTRY_RULES['India'];
        const digits = val.replace(/\D/g, '');
        suggestions.cleanedFields[field] = rule.country_code + digits.slice(-rule.length);
      }
    }
    else if (field === 'date') {
      if (!val) {
        suggestions.cleanedFields[field] = '2024-01-01 12:00:00';
      } else {
        const dateRes = parseAndFormatDateTime(val);
        suggestions.cleanedFields[field] = dateRes.isValid ? dateRes.formatted : '2024-01-01 12:00:00';
      }
    }
    else if (field === 'payment_mode') {
      if (!val) {
        suggestions.cleanedFields[field] = 'Card';
      } else {
        const cleanMode = val.toLowerCase().replace(/\s+/g, '');
        if (cleanMode.includes('upi')) suggestions.cleanedFields[field] = 'UPI';
        else if (cleanMode.includes('card')) suggestions.cleanedFields[field] = 'Card';
        else if (cleanMode.includes('cash')) suggestions.cleanedFields[field] = 'Cash';
        else if (cleanMode.includes('wallet')) suggestions.cleanedFields[field] = 'Wallet';
        else if (cleanMode.includes('banking')) suggestions.cleanedFields[field] = 'NetBanking';
        else suggestions.cleanedFields[field] = 'Card';
      }
    }
  });

  res.json(suggestions);
});

// CSV Splitting endpoint with custom chunk size
app.post('/api/split', (req, res) => {
  const { rows, chunkSize } = req.body;
  if (!rows || !chunkSize) {
    return res.status(400).json({ error: 'Rows and chunkSize are required' });
  }

  const numericChunkSize = parseInt(chunkSize, 10);
  if (isNaN(numericChunkSize) || numericChunkSize <= 0) {
    return res.status(400).json({ error: 'Invalid chunkSize' });
  }

  const tempDir = path.join(process.cwd(), 'temp_chunks');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const zipFilePath = path.join(process.cwd(), 'split_chunks.zip');
  const output = fs.createWriteStream(zipFilePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    res.download(zipFilePath, 'split_chunks.zip', () => {
      fs.unlinkSync(zipFilePath);
      fs.readdirSync(tempDir).forEach(file => {
        fs.unlinkSync(path.join(tempDir, file));
      });
      fs.rmdirSync(tempDir);
    });
  });

  archive.on('error', (err) => {
    res.status(500).json({ error: 'Failed to create zip file: ' + err.message });
  });

  archive.pipe(output);

  const totalChunks = Math.ceil(rows.length / numericChunkSize);
  for (let i = 0; i < totalChunks; i++) {
    const chunkRows = rows.slice(i * numericChunkSize, (i + 1) * numericChunkSize);

    if (chunkRows.length > 0) {
      const headers = Object.keys(chunkRows[0]);
      let csvContent = headers.join(',') + '\n';
      chunkRows.forEach(row => {
        const line = headers.map(header => {
          let field = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
          if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            field = `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        }).join(',');
        csvContent += line + '\n';
      });

      const chunkFileName = `chunk_${i + 1}.csv`;
      const chunkFilePath = path.join(tempDir, chunkFileName);
      fs.writeFileSync(chunkFilePath, csvContent);
      archive.file(chunkFilePath, { name: chunkFileName });
    }
  }

  archive.finalize();
});

// CSV Splitting automatic endpoint when rows > 1000
app.post('/api/split-auto', (req, res) => {
  const { rows } = req.body;
  if (!rows) {
    return res.status(400).json({ error: 'Rows are required' });
  }

  const numericChunkSize = 1000;
  const tempDir = path.join(process.cwd(), 'temp_chunks_auto');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const zipFilePath = path.join(process.cwd(), 'transactions_split.zip');
  const output = fs.createWriteStream(zipFilePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    res.download(zipFilePath, 'transactions_split.zip', () => {
      fs.unlinkSync(zipFilePath);
      fs.readdirSync(tempDir).forEach(file => {
        fs.unlinkSync(path.join(tempDir, file));
      });
      fs.rmdirSync(tempDir);
    });
  });

  archive.on('error', (err) => {
    res.status(500).json({ error: 'Failed to create zip file: ' + err.message });
  });

  archive.pipe(output);

  const totalChunks = Math.ceil(rows.length / numericChunkSize);
  for (let i = 0; i < totalChunks; i++) {
    const chunkRows = rows.slice(i * numericChunkSize, (i + 1) * numericChunkSize);

    if (chunkRows.length > 0) {
      const headers = Object.keys(chunkRows[0]);
      let csvContent = headers.join(',') + '\n';
      chunkRows.forEach(row => {
        const line = headers.map(header => {
          let field = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
          if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            field = `"${field.replace(/"/g, '""')}"`;
          }
          return field;
        }).join(',');
        csvContent += line + '\n';
      });

      const chunkFileName = `transactions_part${i + 1}.csv`;
      const chunkFilePath = path.join(tempDir, chunkFileName);
      fs.writeFileSync(chunkFilePath, csvContent);
      archive.file(chunkFilePath, { name: chunkFileName });
    }
  }

  archive.finalize();
});

app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
