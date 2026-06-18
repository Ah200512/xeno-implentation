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
app.use(express.json());

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

const PHONE_RULES = {
  'IN': { name: 'India', length: 10, prefix: '+91', regex: /^(?:\+91|91)?[6789]\d{9}$/ },
  'SG': { name: 'Singapore', length: 8, prefix: '+65', regex: /^(?:\+65|65)?[689]\d{7}$/ },
  'US': { name: 'United States', length: 10, prefix: '+1', regex: /^(?:\+1|1)?\d{10}$/ }
};

function validateDate(dateStr) {
  if (!dateStr) return false;

  const formats = [
    /^\d{4}-\d{2}-\d{2}$/,
    /^\d{2}\/\d{2}\/\d{4}$/,
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/
  ];
  const isValidFormat = formats.some(regex => regex.test(dateStr.trim()));
  if (!isValidFormat) return false;

  const parsed = Date.parse(dateStr);
  return !isNaN(parsed);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/validate', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const results = [];
  const validRows = [];
  const invalidRows = [];
  const filePath = req.file.path;


  const selectedCountry = req.body.countryCode || 'IN';
  const phoneRule = PHONE_RULES[selectedCountry] || PHONE_RULES['IN'];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => {
      results.push(data);
    })
    .on('end', () => {

      fs.unlinkSync(filePath);

      const seenRows = new Set();


      results.forEach((row, index) => {
        const errors = [];
        const warnings = [];


        const rowTrimmed = {};
        Object.keys(row).forEach(k => {
          rowTrimmed[k] = row[k] ? row[k].trim() : '';


          if (row[k] && row[k] !== row[k].trim()) {
            warnings.push({
              field: k,
              message: `Field '${k}' contains leading or trailing spaces.`
            });
          }
        });



        const rowString = JSON.stringify(rowTrimmed);
        if (seenRows.has(rowString)) {
          errors.push({
            field: 'Row Integrity',
            message: 'Duplicate row detected.'
          });
        } else {
          seenRows.add(rowString);
        }

        const cleanedRow = { ...rowTrimmed };


        Object.keys(rowTrimmed).forEach(header => {
          const lowerHeader = header.toLowerCase();
          const val = rowTrimmed[header];


          if (val === '') {
            errors.push({
              field: header,
              message: `Field '${header}' is missing value.`
            });
            return;
          }


          if (lowerHeader.includes('email')) {
            if (!EMAIL_REGEX.test(val)) {
              errors.push({
                field: header,
                message: `Invalid email address format: '${val}'`
              });
            } else {
              cleanedRow[header] = val.toLowerCase();
            }
          }


          if (lowerHeader.includes('phone') || lowerHeader.includes('mobile')) {

            const digits = val.replace(/\D/g, '');
            let isValid = phoneRule.regex.test(val);

            if (!isValid) {
              errors.push({
                field: header,
                message: `Phone number '${val}' does not match rules for ${phoneRule.name} (Expected ${phoneRule.length} digits, prefix ${phoneRule.prefix})`
              });
            } else {

              cleanedRow[header] = phoneRule.prefix + digits.slice(-phoneRule.length);
            }
          }


          if (lowerHeader.includes('date') || lowerHeader.includes('time')) {
            if (!validateDate(val)) {
              errors.push({
                field: header,
                message: `Invalid date/time format: '${val}' (Expected standard formats like YYYY-MM-DD)`
              });
            } else {
              try {

                const d = new Date(val);
                if (!isNaN(d.getTime())) {
                  cleanedRow[header] = d.toISOString().split('T')[0];
                }
              } catch (e) {

              }
            }
          }


          const ALLOWED_PAYMENT_MODES = ['card', 'upi', 'cash', 'netbanking', 'wallet'];
          if (lowerHeader.includes('payment') || lowerHeader.includes('mode') || lowerHeader.includes('method')) {
            const cleanMode = val.toLowerCase().replace(/\s+/g, '');
            if (!ALLOWED_PAYMENT_MODES.includes(cleanMode)) {
              errors.push({
                field: header,
                message: `Invalid payment mode '${val}'. Allowed values: Card, UPI, Cash, NetBanking, Wallet.`
              });
            } else {
              const standardModes = {
                'card': 'Card',
                'upi': 'UPI',
                'cash': 'Cash',
                'netbanking': 'NetBanking',
                'wallet': 'Wallet'
              };
              cleanedRow[header] = standardModes[cleanMode] || val;
            }
          }


          if (lowerHeader.includes('name') && val) {
            cleanedRow[header] = val.split(' ')
              .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');
          }


          if (lowerHeader.includes('amount') || lowerHeader.includes('price') || lowerHeader.includes('quantity') || lowerHeader.includes('total')) {
            const num = parseFloat(val);
            if (isNaN(num)) {
              errors.push({
                field: header,
                message: `'${header}' should be numeric: '${val}'`
              });
            } else if (num < 0) {
              errors.push({
                field: header,
                message: `'${header}' cannot be negative: ${num}`
              });
            }
          }
        });

        const rowResult = {
          rowIndex: index + 1,
          original: rowTrimmed,
          cleaned: cleanedRow,
          errors,
          warnings,
          isValid: errors.length === 0
        };

        if (rowResult.isValid) {
          validRows.push(rowResult);
        } else {
          invalidRows.push(rowResult);
        }
      });

      res.json({
        totalRows: results.length,
        validCount: validRows.length,
        invalidCount: invalidRows.length,
        validRows,
        invalidRows,
        phoneRuleUsed: phoneRule.name
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
You are an expert data cleansing AI assistant. Below is a row from a transaction dataset that failed validation, along with a list of the specific validation errors identified:

Row Data:
${JSON.stringify(row, null, 2)}

Validation Errors:
${JSON.stringify(errors, null, 2)}

Please analyze the errors and suggest exactly how to clean or correct this row.
Provide a JSON response with:
1. "summary": A brief 1-sentence summary of the issues.
2. "suggestions": An array of specific corrective actions for each field.
3. "cleanedFields": A key-value object containing only the corrected fields (e.g. {"phone": "+919876543210"}).
Respond ONLY with the JSON object, do not include any markdown format or surrounding text.
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


  const suggestions = {
    summary: `Found ${errors.length} formatting issue(s) in this row.`,
    suggestions: errors.map(err => {
      if (err.field.toLowerCase().includes('email')) {
        return `Correct the email domain or check for typos (e.g. '@gamil.com' -> '@gmail.com').`;
      }
      if (err.field.toLowerCase().includes('phone')) {
        return `Format the phone number matching standard country length digits.`;
      }
      if (err.message.includes('missing')) {
        return `Provide a default value or impute missing info for '${err.field}'.`;
      }
      return `Fix value format in field '${err.field}'.`;
    }),
    cleanedFields: {}
  };


  errors.forEach(err => {
    const field = err.field;
    const val = row[field];
    if (field.toLowerCase().includes('email') && val) {
      if (val.includes('gamil.com')) suggestions.cleanedFields[field] = val.replace('gamil.com', 'gmail.com');
      else if (!val.includes('@')) suggestions.cleanedFields[field] = val + '@gmail.com';
    }
    if (field.toLowerCase().includes('phone') && val) {

      suggestions.cleanedFields[field] = val.replace(/\D/g, '');
    }
  });

  res.json(suggestions);
});

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
