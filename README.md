# Xeno Intern Assessment: SQL Engine & Transaction Validation Platform

A repository containing the database queries, data transformation pipelines, and full-stack web application implemented for the Xeno Internship Assessment.

---

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Database & SQL Assessment (Parts 1-3)](#database--sql-assessment-parts-1-3)
3. [Transaction Validation Web App (Part 4)](#transaction-validation-web-app-part-4)
4. [Tech Stack](#tech-stack)
5. [Setup & Installation](#setup--installation)

---

## 🔍 Project Overview

This project consists of two key components:
1. **SQL Database Assessment (Parts 1, 2, & 3)**: A Python and SQLite data pipeline that imports customer lists, executes complex queries (data familiarity, transformation, and business intelligence reporting), and renders an automated HTML & PDF report using headless Chrome.
2. **Transaction Validation Platform (Part 4)**: A full-stack web application featuring a React-based interactive UI and an Express backend. It validates transaction records, runs rule-based checks on fields (emails, phone prefixes, dates, payment types), connects with Google Gemini AI for formatting suggestions, and splits processed CSVs.

---

## 🗄️ Database & SQL Assessment (Parts 1-3)

The SQL assessment parses and analyses transaction data using a relational SQLite database structure:

* **Part 1: SQL & Data Familiarity**
  * Data pre-import validation logic.
  * Queries filtering signups by location, identifying 30-day signup volumes, extracting unique active cities, and finding inactive customers (zero order logs).
* **Part 2: Data Transformation & Enrichment**
  * Automated column schema enrichment (`is_gmail`, `first_name`, `signup_month`).
  * Row-level weekday mapping and dynamic table creations for target segments (`vip_customers`).
* **Part 3: Analytics & Reporting**
  * Month-over-month signup trends, density analysis by city, and peak signup activity profiling.

---

## 💻 Transaction Validation Web App (Part 4)

An enterprise-ready CSV upload utility and interactive cleaning dashboard:

* **Backend (`/backend`)**:
  * **Validation Engine (`/api/validate`)**: Normalizes case styling, trims whitespace, verifies date patterns, flags duplicate rows, and implements region-based phone validation (India, US, Singapore).
  * **AI suggestions (`/api/ai-suggestions`)**: Integrated with Google Gemini API to analyze dirty rows and return schema-valid corrections.
  * **Exporter (`/api/split`)**: Formats valid outputs and compresses them into split-sized CSV chunks packed within a `.zip` archive.
* **Frontend (`/frontend`)**:
  * Clean UI built using React + Vite.
  * File drop-zone, validation metrics cards (Total/Clean/Dirty counters), data tables highlighting error fields in red, and an AI-assist sidebar panel.

---

## 🛠️ Tech Stack

* **Database Engine & Reporting**: SQLite 3, Python 3, Pandas, Headless Google Chrome
* **Backend Server**: Node.js, Express, Multer, Archiver, Google Generative AI SDK
* **Frontend Client**: React 18, Vite, Lucide React, CSS Variables

---

## 🚀 Setup & Installation

### Prerequisite
Ensure you have Node.js, Python 3, and Google Chrome installed.

### 1. Database & SQL PDF Setup
Run the script to convert inputs, create tables, query metrics, and print the PDF report:
```bash
# Convert Excel sheet to CSV
python convert.py

# Generate report html & build SQL_Assignment.pdf
python generate_pdf_report.py
```

### 2. Backend Server Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the backend root directory and add your Google Gemini API key:
   ```env
   PORT=5000
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
4. Start the server:
   ```bash
   npm run dev
   ```

### 3. Frontend Client Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173` to interact with the web app.
