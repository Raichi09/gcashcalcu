/* =========================================================
   GCash Cash-In & Cash-Out Fee Calculator
   Midnight-Based Day Penalty
========================================================= */

const DATABASE_KEY = "cashin_transactions_v7";

/* =========================================================
   RULE CONSTANTS
========================================================= */

const HOURS_PER_DAY = 24;
const FREE_HOURS = 4;

const HOURLY_RATE = 1;
const DAY_PENALTY = 2;

const HIGH_FIRST_DAY = 50;
const HIGH_NEXT_DAY = 30;


/* =========================================================
   ROUND TO NEAREST ₱5
========================================================= */

function roundToFive(amount) {
    return Math.round(amount / 5) * 5;
}


/* =========================================================
   PESO FORMAT
========================================================= */

function peso(amount) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}


/* =========================================================
   GET ELEMENT
========================================================= */

function getElement(id) {
    return document.getElementById(id);
}


/* =========================================================
   SET TEXT
========================================================= */

function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent = value;
    }
}


/* =========================================================
   BASE FEE
========================================================= */

function getBaseFee(amount) {

    if (amount >= 1 && amount <= 500) {
        return 5;
    }

    if (amount >= 501 && amount <= 1999) {
        return 10;
    }

    if (amount >= 2000 && amount <= 5000) {
        return 15;
    }

    if (amount >= 5001 && amount <= 9999) {
        return 35;
    }

    if (amount >= 10000 && amount <= 50000) {
        return 60;
    }

    return null;
}


/* =========================================================
   GET DATE/TIME
========================================================= */

function getDateTime(id) {

    const element = getElement(id);

    if (!element || !element.value) {
        return null;
    }

    const date = new Date(element.value);

    if (isNaN(date.getTime())) {
        return null;
    }

    return date;
}


/* =========================================================
   CALCULATE ELAPSED TIME

   Minutes are ignored for fee calculation.
========================================================= */

function calculateElapsed(start, end) {

    const difference =
        end.getTime() - start.getTime();

    if (difference < 0) {
        return null;
    }

    const totalMinutes =
        Math.floor(
            difference / (1000 * 60)
        );

    const totalHours =
        Math.floor(
            totalMinutes / 60
        );

    const minutes =
        totalMinutes % 60;

    const days =
        Math.floor(
            totalHours / HOURS_PER_DAY
        );

    const hours =
        totalHours % HOURS_PER_DAY;

    return {
        totalHours,
        days,
        hours,
        minutes
    };
}


/* =========================================================
   COUNT MIDNIGHTS CROSSED

   THIS IS THE IMPORTANT CHANGE.

   Example:

   August 12 - 4:00 PM
   August 13 - 12:00 AM

   = 1 midnight crossed

   August 12 - 4:00 PM
   August 14 - 12:00 AM

   = 2 midnights crossed

   It does NOT wait for 24 hours.
========================================================= */

function calculateMidnightsCrossed(start, end) {

    const startDate = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
    );

    const endDate = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate()
    );

    const difference =
        endDate.getTime() -
        startDate.getTime();

    const days =
        Math.floor(
            difference /
            (1000 * 60 * 60 * 24)
        );

    return Math.max(0, days);
}


/* =========================================================
   MAIN CALCULATOR
========================================================= */

function calculateFee() {

    const customerElement =
        getElement("customerName");

    const cashInElement =
        getElement("cashIn");

    const settledElement =
        getElement("settled");

    const customerName =
        customerElement
            ? customerElement.value.trim()
            : "";

    const cashIn =
        cashInElement
            ? parseFloat(cashInElement.value)
            : NaN;

    const cashInTime =
        getDateTime("cashInTime");

    const paymentTime =
        getDateTime("paymentTime");

    const settled =
        settledElement
            ? settledElement.checked
            : false;


    clearMessage();


    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!customerName) {
        showError(
            "Please enter the customer name."
        );
        return;
    }


    if (
        !Number.isFinite(cashIn) ||
        cashIn <= 0
    ) {
        showError(
            "Please enter a valid cash-in amount."
        );
        return;
    }


    if (cashIn > 50000) {
        showError(
            "Maximum transaction amount is ₱50,000."
        );
        return;
    }


    if (!cashInTime) {
        showError(
            "Please enter the cash-in date and time."
        );
        return;
    }


    if (!paymentTime) {
        showError(
            "Please enter the payment date and time."
        );
        return;
    }


    if (paymentTime < cashInTime) {
        showError(
            "Payment time cannot be earlier than cash-in time."
        );
        return;
    }


    /* =====================================================
       ELAPSED TIME
    ===================================================== */

    const elapsed =
        calculateElapsed(
            cashInTime,
            paymentTime
        );

    if (!elapsed) {
        showError(
            "Unable to calculate elapsed time."
        );
        return;
    }


    const totalHours =
        elapsed.totalHours;


    const remainingHours =
        totalHours % HOURS_PER_DAY;


    /* =====================================================
       MIDNIGHTS CROSSED

       NEW SYSTEM:
       NOT 24-HOUR PERIODS.

       Every calendar midnight crossed = 1 day.
    ===================================================== */

    const lateDays =
        calculateMidnightsCrossed(
            cashInTime,
            paymentTime
        );


    /* =====================================================
       SETTLEMENT RULE
    ===================================================== */

    if (
        totalHours > 0 &&
        !settled
    ) {

        showError(
            "NO SETTLEMENT, NO CASH-IN: Please settle the previous debt first."
        );

        return;
    }


    /* =====================================================
       BASE FEE
    ===================================================== */

    const baseFee =
        getBaseFee(cashIn);


    if (baseFee === null) {
        showError(
            "Could not determine the base fee."
        );
        return;
    }


    /* =====================================================
       INITIAL VALUES
    ===================================================== */

    let dayPenalty = 0;

    let chargeableHours = 0;

    let hourlyPenalty = 0;

    let rawLatePenalty = 0;

    let roundedLatePenalty = 0;


    /* =====================================================
       BELOW ₱100

       NO LATE PENALTY
    ===================================================== */

    if (cashIn < 100) {

        dayPenalty = 0;

        chargeableHours = 0;

        hourlyPenalty = 0;

        rawLatePenalty = 0;

        roundedLatePenalty = 0;
    }


    /* =====================================================
       ₱100 – ₱1,999

       First 4 hours are FREE.

       Hourly penalty:
       Every completed hour after free hours = ₱1.

       Midnight penalty:
       Every midnight crossed = ₱2.

       IMPORTANT:
       Midnight penalty does NOT require 24 hours.
    ===================================================== */

    else if (cashIn <= 1999) {

        /* ---------------------------------------------
           MIDNIGHT PENALTY
        --------------------------------------------- */

        dayPenalty =
            lateDays *
            DAY_PENALTY;


        /* ---------------------------------------------
           HOURLY PENALTY

           First 4 completed hours are free.

           Everything after that is ₱1/hour.

           Example:

           4 PM → 12 AM
           = 8 completed hours

           4 free hours
           4 chargeable hours
           = ₱4
        --------------------------------------------- */

        chargeableHours =
            Math.max(
                0,
                totalHours - FREE_HOURS
            );


        hourlyPenalty =
            chargeableHours *
            HOURLY_RATE;


        /* ---------------------------------------------
           TOTAL LATE PENALTY
        --------------------------------------------- */

        rawLatePenalty =
            dayPenalty +
            hourlyPenalty;


        roundedLatePenalty =
            roundToFive(
                rawLatePenalty
            );
    }


    /* =====================================================
       ₱2,000 AND ABOVE

       First midnight:
       ₱50

       Second midnight:
       + ₱30

       Third midnight:
       + ₱30

       No hourly penalty.
    ===================================================== */

    else {

        chargeableHours = 0;

        hourlyPenalty = 0;


        if (lateDays >= 1) {

            dayPenalty =
                HIGH_FIRST_DAY +
                (
                    (lateDays - 1) *
                    HIGH_NEXT_DAY
                );

            rawLatePenalty =
                dayPenalty;

            roundedLatePenalty =
                roundToFive(
                    rawLatePenalty
                );
        }
    }


    /* =====================================================
       TOTAL FEE
    ===================================================== */

    const rawTotalFee =
        baseFee +
        roundedLatePenalty;


    const totalFee =
        roundToFive(
            rawTotalFee
        );


    const totalToPay =
        cashIn +
        totalFee;


    /* =====================================================
       DISPLAY RESULT
    ===================================================== */

    setText(
        "resultName",
        customerName
    );

    setText(
        "resultCashIn",
        peso(cashIn)
    );

    setText(
        "resultCashInTime",
        formatDate(cashInTime)
    );

    setText(
        "resultPaymentTime",
        formatDate(paymentTime)
    );

    setText(
        "resultElapsedTime",
        `${elapsed.days} day(s), ` +
        `${elapsed.hours} hour(s), ` +
        `${elapsed.minutes} minute(s)`
    );

    setText(
        "resultCompletedHours",
        totalHours
    );

    setText(
        "resultLateDays",
        lateDays
    );

    setText(
        "resultBaseFee",
        peso(baseFee)
    );

    setText(
        "resultDayPenalty",
        peso(dayPenalty)
    );

    setText(
        "resultChargeableHours",
        chargeableHours
    );

    setText(
        "resultHourlyPenalty",
        peso(hourlyPenalty)
    );

    setText(
        "resultRawPenalty",
        peso(rawLatePenalty)
    );

    setText(
        "resultPenalty",
        peso(roundedLatePenalty)
    );

    setText(
        "resultRawFee",
        peso(rawTotalFee)
    );

    setText(
        "resultFee",
        peso(totalFee)
    );

    setText(
        "resultTotal",
        peso(totalToPay)
    );


    /* =====================================================
       BREAKDOWN
    ===================================================== */

    const breakdown =
        getElement("breakdown");


    if (breakdown) {

        breakdown.innerHTML = `

            <div class="breakdown-title">
                Fee Calculation Breakdown
            </div>

            <strong>Customer:</strong>
            ${escapeHtml(customerName)}

            <br><br>

            <strong>Cash-In:</strong>
            ${peso(cashIn)}

            <br>

            <strong>Base Fee:</strong>
            ${peso(baseFee)}

            <br><br>

            <strong>Cash-In Time:</strong>
            ${formatDate(cashInTime)}

            <br>

            <strong>Payment Time:</strong>
            ${formatDate(paymentTime)}

            <br>

            <strong>Elapsed:</strong>
            ${elapsed.days}
            day(s),
            ${elapsed.hours}
            hour(s),
            ${elapsed.minutes}
            minute(s)

            <br>

            <strong>Completed Hours:</strong>
            ${totalHours}

            <br><br>

            <strong>Midnights Crossed:</strong>
            ${lateDays}

            <br>

            <small>
                Every calendar midnight crossed adds
                ₱${DAY_PENALTY.toFixed(2)}
                for ₱100–₱1,999 transactions.
            </small>

            <br><br>

            <strong>Day Penalty:</strong>
            ${peso(dayPenalty)}

            <br>

            <strong>Free Hours:</strong>
            ${FREE_HOURS}

            <br>

            <strong>Chargeable Hours:</strong>
            ${chargeableHours}

            <br>

            <strong>Hourly Rate:</strong>
            ${
                cashIn >= 100 &&
                cashIn <= 1999
                    ? "₱1.00/hour"
                    : "None"
            }

            <br>

            <strong>Hourly Penalty:</strong>
            ${peso(hourlyPenalty)}

            <br><br>

            <strong>Raw Late Penalty:</strong>
            ${peso(rawLatePenalty)}

            <br>

            <strong>Rounded Late Penalty:</strong>
            ${peso(roundedLatePenalty)}

            <br><br>

            <strong>Base Fee + Late Penalty:</strong>
            ${peso(rawTotalFee)}

            <br>

            <strong>Rounded Total Fee:</strong>
            ${peso(totalFee)}

            <br><br>

            <strong>TOTAL TO PAY:</strong>
            ${peso(totalToPay)}

        `;
    }


    const result =
        getElement("result");


    if (result) {
        result.style.display = "block";
    }


    /* =====================================================
       SAVE TRANSACTION
    ===================================================== */

    saveTransaction({

        id:
            createTransactionId(),

        date:
            new Date().toISOString(),

        customerName,

        cashIn,

        cashInTime:
            cashInTime.toISOString(),

        paymentTime:
            paymentTime.toISOString(),

        elapsedDays:
            elapsed.days,

        elapsedHours:
            elapsed.hours,

        elapsedMinutes:
            elapsed.minutes,

        completedHours:
            totalHours,

        lateDays,

        remainingHours,

        baseFee,

        dayPenalty,

        chargeableHours,

        hourlyPenalty,

        rawLatePenalty,

        latePenalty:
            roundedLatePenalty,

        rawTotalFee,

        totalFee,

        totalToPay,

        settled

    });
}


/* =========================================================
   CREATE TRANSACTION ID
========================================================= */

function createTransactionId() {

    return (
        "TXN-" +
        Date.now() +
        "-" +
        Math.floor(
            1000 +
            Math.random() * 9000
        )
    );
}


/* =========================================================
   SAVE TRANSACTION
========================================================= */

function saveTransaction(transaction) {

    const transactions =
        getTransactions();

    transactions.unshift(
        transaction
    );

    saveTransactions(
        transactions
    );

    displayRecords();
}


/* =========================================================
   GET TRANSACTIONS
========================================================= */

function getTransactions() {

    const saved =
        localStorage.getItem(
            DATABASE_KEY
        );

    if (!saved) {
        return [];
    }

    try {

        const data =
            JSON.parse(saved);

        return Array.isArray(data)
            ? data
            : [];

    } catch (error) {

        console.error(
            "Database error:",
            error
        );

        return [];
    }
}


/* =========================================================
   SAVE TRANSACTIONS
========================================================= */

function saveTransactions(transactions) {

    localStorage.setItem(
        DATABASE_KEY,
        JSON.stringify(
            transactions
        )
    );
}


/* =========================================================
   DISPLAY DATABASE
========================================================= */

function displayRecords() {

    const table =
        getElement(
            "transactionTable"
        );

    const count =
        getElement(
            "recordCount"
        );

    if (!table) {
        return;
    }


    const transactions =
        getTransactions();


    const searchElement =
        getElement(
            "searchInput"
        );


    const search =
        searchElement
            ? searchElement.value
                .trim()
                .toLowerCase()
            : "";


    const filtered =
        transactions.filter(
            transaction =>
                String(
                    transaction.customerName ||
                    ""
                )
                .toLowerCase()
                .includes(search)
        );


    if (count) {
        count.textContent =
            transactions.length;
    }


    table.innerHTML = "";


    if (filtered.length === 0) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="14"
                    class="empty-database"
                >
                    No transactions found.
                </td>

            </tr>

        `;

        return;
    }


    filtered.forEach(
        transaction => {

            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>
                    ${formatDate(
                        transaction.date
                    )}
                </td>

                <td>
                    ${escapeHtml(
                        transaction.customerName
                    )}
                </td>

                <td>
                    ${peso(
                        transaction.cashIn || 0
                    )}
                </td>

                <td>
                    ${formatDate(
                        transaction.cashInTime
                    )}
                </td>

                <td>
                    ${formatDate(
                        transaction.paymentTime
                    )}
                </td>

                <td>
                    ${transaction.completedHours ?? 0}
                </td>

                <td>
                    ${peso(
                        transaction.baseFee || 0
                    )}
                </td>

                <td>
                    ${peso(
                        transaction.dayPenalty || 0
                    )}
                </td>

                <td>
                    ${transaction.chargeableHours ?? 0}
                </td>

                <td>
                    ${peso(
                        transaction.hourlyPenalty || 0
                    )}
                </td>

                <td>
                    ${peso(
                        transaction.latePenalty || 0
                    )}
                </td>

                <td>
                    ${peso(
                        transaction.totalFee || 0
                    )}
                </td>

                <td>
                    <strong>
                        ${peso(
                            transaction.totalToPay || 0
                        )}
                    </strong>
                </td>

                <td>

                    <button
                        type="button"
                        class="delete-btn"
                        onclick="deleteTransaction('${transaction.id}')"
                    >
                        DELETE
                    </button>

                </td>

            `;


            table.appendChild(row);
        }
    );
}


/* =========================================================
   DELETE ONE TRANSACTION
========================================================= */

function deleteTransaction(id) {

    if (
        !confirm(
            "Are you sure you want to delete this transaction?"
        )
    ) {
        return;
    }


    let transactions =
        getTransactions();


    transactions =
        transactions.filter(
            transaction =>
                transaction.id !== id
        );


    saveTransactions(
        transactions
    );


    displayRecords();
}


/* =========================================================
   DELETE ALL
========================================================= */

function deleteAllRecords() {

    const transactions =
        getTransactions();


    if (transactions.length === 0) {

        alert(
            "There are no transactions to delete."
        );

        return;
    }


    if (
        !confirm(
            "WARNING: This will delete ALL transactions from this browser. Continue?"
        )
    ) {
        return;
    }


    localStorage.removeItem(
        DATABASE_KEY
    );


    displayRecords();
}


/* =========================================================
   FORMAT DATE
========================================================= */

function formatDate(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (
        isNaN(
            date.getTime()
        )
    ) {
        return "-";
    }


    return date.toLocaleString(
        "en-PH",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true
        }
    );
}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        text == null
            ? ""
            : String(text);

    return div.innerHTML;
}


/* =========================================================
   SHOW ERROR
========================================================= */

function showError(message) {

    const error =
        getElement(
            "errorMessage"
        );


    if (!error) {
        alert(message);
        return;
    }


    error.textContent =
        message;

    error.style.display =
        "block";
}


/* =========================================================
   CLEAR MESSAGE
========================================================= */

function clearMessage() {

    const error =
        getElement(
            "errorMessage"
        );


    if (!error) {
        return;
    }


    error.textContent = "";

    error.style.display =
        "none";
}


/* =========================================================
   CLEAR CALCULATOR
========================================================= */

function clearCalculator() {

    [
        "customerName",
        "cashIn",
        "cashInTime",
        "paymentTime"
    ].forEach(
        id => {

            const element =
                getElement(id);

            if (element) {
                element.value = "";
            }
        }
    );


    const settled =
        getElement("settled");


    if (settled) {
        settled.checked = false;
    }


    clearMessage();


    const result =
        getElement("result");


    if (result) {
        result.style.display =
            "none";
    }
}


/* =========================================================
   START DATABASE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        displayRecords();

    }
);
