# BirthSense Project Analysis & Workflow

## Project Overview
**BirthSense** is a web-based medical application designed to predict the mode of delivery (Vaginal vs. C-Section) for pregnant patients. It uses a **Hybrid Prediction Model** that combines a Machine Learning (Random Forest) algorithm with strict Clinical Rules to ensure safety and accuracy.

## System Architecture
*   **Frontend:** Vanilla HTML, CSS, and JavaScript.
*   **Backend:** Node.js with Express.
*   **Database:** MongoDB (using Mongoose).
*   **ML Engine:** Python (`scikit-learn`, `pandas`) integrated via `python-shell`.
*   **Authentication:** JWT (JSON Web Tokens) with role-based access control.

---

## Detailed Workflow

The application follows a linear flow involving four key actors: **Staff/Nurse (Data Entry)**, **Nurse (Reviewer)**, **Doctor**, and **Patient**.

### 1. Data Entry (Staff/Nurse)
*   **Interface:** `data_entry.html`
*   **Action:** A user logs in and enters comprehensive patient details into a multi-section form.
    *   **Sections:** Patient Identity, Basic Maternal Info, Obstetric History, Current Pregnancy Details, Labor & Delivery Info.
    *   **Validation:** The form includes real-time validation for clinical ranges (e.g., BMI, Blood Pressure).
*   **Submission:** When submitted, the data is saved to the database with a status of `PENDING`.
*   **Correction Loop:** If a record is later **Disapproved** by a reviewer, it reappears in the "Disapproved for Edit" tab on this page, allowing the user to correct and resubmit it.

### 2. Clinical Review (Nurse)
*   **Interface:** `nurse.html`
*   **Action:** A Nurse reviews pending patient submissions.
    *   **Approve:** Validates the data is correct. The patient status updates to `APPROVED` and moves to the Doctor's queue.
    *   **Disapprove:** Flags the record with a reason (e.g., "Incorrect BP reading"). The status updates to `DISAPPROVED` and it is sent back to the Data Entry stage for correction.

### 3. Prediction & Finalization (Doctor)
*   **Interface:** `doctor.html` (Implied)
*   **Action:** The Doctor views patients who have been **Approved** by the nurse.
*   **Prediction Trigger:** The Doctor clicks "Predict" for a specific patient.
*   **Backend Process:**
    1.  **Data Fetching:** The Node.js backend retrieves the patient's medical data.
    2.  **ML Execution:** It spawns a Python subprocess (`ml_model.py`) passing the data as JSON.
    3.  **Hybrid Logic (Python):**
        *   **Clinical Pre-Filter:** Checks non-negotiable rules first (e.g., *Placenta Previa* or *Fetal Distress* = Immediate C-Section).
        *   **ML Model:** If no rules trigger, it runs a Random Forest model (selecting between a "First-Time Mother" model or "Prior History" model).
        *   **Risk Adjustment:** The ML confidence score is adjusted based on a calculated "Clinical Risk Score" (High/Medium/Low).
    4.  **Save & Notify:** The result (e.g., "Vaginal Delivery", "95% Confidence") is saved to the database.

### 4. Patient Notification & Report
*   **Trigger:** Automatically triggered after a successful prediction.
*   **Notification:** The system sends an email (via `nodemailer`) to the patient containing a secure link.
*   **Verification:** The patient clicks the link and must verify their identity (2FA) using their **Patient ID**, **Email**, and **Phone Number**.
*   **Report:** Upon verification, they are shown a simplified report (`patient_report.html`) with the prediction result and doctor's notes.

---

## Key Files & Components

| Component | File Path | Description |
| :--- | :--- | :--- |
| **Backend Entry** | `backend/server.js` | Main Express server setup, route definitions, and static file serving. |
| **ML Controller** | `backend/controllers/predictionController.js` | Handles the API request, prepares data, and invokes the Python script. |
| **ML Engine** | `backend/ml_service/ml_model.py` | The core Python script containing the Hybrid Model logic (Rules + ML). |
| **Notifications** | `backend/controllers/notificationController.js` | Handles sending emails (Nodemailer) and verifying patient identity. |
| **Data Entry UI** | `data_entry.html` | The primary form for inputting patient data. |
| **Nurse UI** | `nurse.html` | Dashboard for reviewing and approving/disapproving submissions. |

## Technical Details
*   **Hybrid ML:** The Python script (`ml_model.py`) uses "Lazy Loading" for performance and includes specific logic for "First-Time" vs. "Returning" mothers. It applies a "Clinical Risk Score" to override or adjust ML confidence based on medical heuristics.
*   **Notification:** Currently set up for Email (`nodemailer`). There is legacy code for SMS (`twilio`) which appears to be optional or deprecated.
*   **Security:** The system uses `httpOnly` cookies for JWT authentication and requires 2FA (ID + Email + Phone) for patients to view their sensitive medical reports.
