/* =====================================================
   CASH-IN & CASH-OUT FEE CALCULATOR
===================================================== */


/* =====================================================
   DATABASE
===================================================== */

const DATABASE_KEY = "cashin_transactions_v5";


/* =====================================================
   RULE CONSTANTS
===================================================== */

const HOURS_PER_DAY = 24;

const FREE_HOURS = 4;

/*
   ₱100 – ₱1,999
   After 4 free hours = ₱1/hour
*/
const HOURLY_RATE = 1;

/*
   ₱100 – ₱1,999
   Every completed 24-hour day = ₱2
*/
const DAY_PENALTY = 2;


/*
   ₱2,000 AND ABOVE

   Day 1 = ₱50
   Day 2 onward = ₱30 per completed day
*/
const HIGH_FIRST_DAY = 50;

const HIGH_NEXT_DAY = 30;


/* =====================================================
   ROUND TO NEAREST ₱5
===================================================== */

function roundToFive(amount) {

    return Math.round(amount / 5) * 5;

}


/* =====================================================
   PESO FORMAT
===================================================== */

function peso(amount) {

    return new Intl.NumberFormat(
        "en-PH",
        {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    ).format(amount);

}


/* =====================================================
   GET ELEMENT SAFELY
===================================================== */

function getElement(id) {

    return document.getElementById(id);

}


/* =====================================================
   SET TEXT SAFELY
===================================================== */

function setText(id, value) {

    const element = getElement(id);

    if (element) {

        element.textContent = value;

    }

}


/* =====================================================
   BASE FEE

   ₱1 – ₱500       = ₱5
   ₱501 – ₱1,999   = ₱10
   ₱2,000 – ₱5,000 = ₱15
   ₱5,001 – ₱9,999 = ₱35
   ₱10,000 – ₱50k  = ₱60
===================================================== */

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


/* =====================================================
   GET DATE/TIME
===================================================== */

function getDateTime(id) {

    const element = getElement(id);

    if (!element) {

        return null;

    }

    if (!element.value) {

        return null;

    }

    const date = new Date(element.value);

    if (isNaN(date.getTime())) {

        return null;

    }

    return date;

}


/* =====================================================
   CALCULATE ELAPSED TIME

   Minutes are ignored.

   Example:

   5 days, 7 hours, 35 minutes

   becomes:

   127 completed hours

   The 35 minutes do not affect the fee.
===================================================== */

function calculateElapsed(start, end) {

    const difference =
        end.getTime() -
        start.getTime();


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

        totalHours: totalHours,

        days: days,

        hours: hours,

        minutes: minutes

    };

}


/* =====================================================
   MAIN CALCULATOR
===================================================== */

function calculateFee() {

    console.log("CALCULATE BUTTON PRESSED");


    /* =================================================
       GET INPUTS
    ================================================= */

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


    /* =================================================
       CLEAR OLD ERROR / RESULT
    ================================================= */

    const errorMessage =
        getElement("errorMessage");


    const result =
        getElement("result");


    if (errorMessage) {

        errorMessage.textContent = "";

        errorMessage.style.display = "none";

    }


    if (result) {

        result.style.display = "none";

    }


    /* =================================================
       VALIDATION
    ================================================= */

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


    /* =================================================
       CALCULATE ELAPSED TIME
    ================================================= */

    const elapsed =
        calculateElapsed(
            cashInTime,
            paymentTime
        );


    if (!elapsed) {

        showError(
            "Unable to calculate the elapsed time."
        );

        return;

    }


    /* =================================================
       COMPLETED HOURS ONLY
    ================================================= */

    const totalHours =
        elapsed.totalHours;


    const lateDays =
        Math.floor(
            totalHours / HOURS_PER_DAY
        );


    const remainingHours =
        totalHours % HOURS_PER_DAY;


    /* =================================================
       SETTLEMENT RULE

       If there is at least 1 completed hour,
       settlement must be checked.

       0 hours 45 minutes
       = settlement NOT required.

       1 hour 1 minute
       = settlement IS required.
    ================================================= */

    const hasCompletedHours =
        totalHours > 0;


    if (
        hasCompletedHours &&
        !settled
    ) {

        showError(
            "NO SETTLEMENT, NO CASH-IN: Please settle the previous debt before making another transaction."
        );

        return;

    }


    /* =================================================
       GET BASE FEE
    ================================================= */

    const baseFee =
        getBaseFee(cashIn);


    if (baseFee === null) {

        showError(
            "Could not determine the base fee."
        );

        return;

    }


    /* =================================================
       INITIALIZE FEE VARIABLES
    ================================================= */

    let dayPenalty = 0;

    let chargeableHours = 0;

    let hourlyPenalty = 0;

    let rawLatePenalty = 0;

    let roundedLatePenalty = 0;

    let rawTotalFee = 0;

    let totalFee = 0;

    let totalToPay = 0;


    /* =====================================================
       RULE 1
       BELOW ₱100

       Base fee only.
       No late penalty.
    ===================================================== */

    if (cashIn < 100) {

        dayPenalty = 0;

        chargeableHours = 0;

        hourlyPenalty = 0;

        rawLatePenalty = 0;

        roundedLatePenalty = 0;

    }


    /* =====================================================
       RULE 2
       ₱100 – ₱1,999

       First 4 hours = FREE.

       After the first 4 hours:
       ₱1 per completed hour.

       Every completed 24-hour day:
       + ₱2 day penalty.

       Minutes ignored.
    ===================================================== */

    else if (
        cashIn >= 100 &&
        cashIn <= 1999
    ) {


        /* ---------------------------------------------
           DAY PENALTY
        --------------------------------------------- */

        dayPenalty =
            lateDays *
            DAY_PENALTY;


        /* ---------------------------------------------
           FULL DAY CHARGEABLE HOURS

           24 hours
           - 4 free hours
           = 20 chargeable hours
        --------------------------------------------- */

        const fullDayChargeableHours =
            lateDays *
            (
                HOURS_PER_DAY -
                FREE_HOURS
            );


        /* ---------------------------------------------
           EXTRA HOURS

           First 4 remaining hours are FREE.

           Hours after 4 are charged ₱1/hour.
        --------------------------------------------- */

        let extraChargeableHours = 0;


        if (
            remainingHours > FREE_HOURS
        ) {

            extraChargeableHours =
                remainingHours -
                FREE_HOURS;

        }


        /* ---------------------------------------------
           TOTAL CHARGEABLE HOURS
        --------------------------------------------- */

        chargeableHours =
            fullDayChargeableHours +
            extraChargeableHours;


        /* ---------------------------------------------
           HOURLY PENALTY
        --------------------------------------------- */

        hourlyPenalty =
            chargeableHours *
            HOURLY_RATE;


        /* ---------------------------------------------
           RAW LATE PENALTY
        --------------------------------------------- */

        rawLatePenalty =
            dayPenalty +
            hourlyPenalty;


        /* ---------------------------------------------
           ROUND LATE PENALTY
        --------------------------------------------- */

        roundedLatePenalty =
            roundToFive(
                rawLatePenalty
            );

    }


    /* =====================================================
       RULE 3
       ₱2,000 AND ABOVE

       Day 1 = ₱50

       Day 2 onward:
       ₱30 per completed day.

       NO HOURLY PENALTY.
    ===================================================== */

    else {

        /* ---------------------------------------------
           NO HOURLY PENALTY
        --------------------------------------------- */

        chargeableHours = 0;

        hourlyPenalty = 0;


        /* ---------------------------------------------
           COMPLETED DAYS
        --------------------------------------------- */

        if (lateDays >= 1) {


            /* -----------------------------------------
               DAY 1 = ₱50
            ----------------------------------------- */

            dayPenalty =
                HIGH_FIRST_DAY;


            /* -----------------------------------------
               DAY 2 ONWARD = ₱30 EACH
            ----------------------------------------- */

            const additionalDays =
                lateDays - 1;


            dayPenalty =
                HIGH_FIRST_DAY +
                (
                    additionalDays *
                    HIGH_NEXT_DAY
                );


            /* -----------------------------------------
               RAW LATE PENALTY
            ----------------------------------------- */

            rawLatePenalty =
                dayPenalty;


            /* -----------------------------------------
               ROUND LATE PENALTY
            ----------------------------------------- */

            roundedLatePenalty =
                roundToFive(
                    rawLatePenalty
                );

        }

    }


    /* =====================================================
       BASE FEE + LATE PENALTY
    ===================================================== */

    rawTotalFee =
        baseFee +
        roundedLatePenalty;


    /* =====================================================
       FINAL TOTAL FEE

       Round FINAL fee to nearest ₱5.
    ===================================================== */

    totalFee =
        roundToFive(
            rawTotalFee
        );


    /* =====================================================
       TOTAL TO PAY

       Cash-In + Total Fee
    ===================================================== */

    totalToPay =
        cashIn +
        totalFee;


    /* =====================================================
       CREATE BREAKDOWN
    ===================================================== */

    const breakdownHTML = `

        <div class="breakdown-title">
            Fee Calculation Breakdown
        </div>

        <strong>
            Cash-In Time:
        </strong>

        ${formatDate(cashInTime)}

        <br>

        <strong>
            Payment Time:
        </strong>

        ${formatDate(paymentTime)}

        <br><br>

        <strong>
            Elapsed Time:
        </strong>

        ${elapsed.days}
        day(s),
        ${elapsed.hours}
        hour(s),
        ${elapsed.minutes}
        minute(s)

        <br>

        <small>
            ⚠ Minutes are ignored in the fee calculation.
        </small>

        <br><br>

        <strong>
            Completed Hours:
        </strong>

        ${totalHours}
        hour(s)

        <br>

        <strong>
            Full Late Days:
        </strong>

        ${lateDays}
        day(s)

        <br>

        <strong>
            Remaining Hours:
        </strong>

        ${remainingHours}
        hour(s)

        <br><br>

        <strong>
            Base Fee:
        </strong>

        ${peso(baseFee)}

        <br>

        <strong>
            Day Penalty:
        </strong>

        ${peso(dayPenalty)}

        <br>

        <strong>
            Chargeable Hours:
        </strong>

        ${chargeableHours}
        hour(s)

        <br>

        <strong>
            Hourly Rate:
        </strong>

        ${cashIn >= 100 && cashIn <= 1999
            ? "₱1.00/hour"
            : "No hourly penalty"
        }

        <br>

        <strong>
            Hourly Penalty:
        </strong>

        ${peso(hourlyPenalty)}

        <br><br>

        <strong>
            Raw Late Penalty:
        </strong>

        ${peso(rawLatePenalty)}

        <br>

        <strong>
            Rounded Late Penalty:
        </strong>

        ${peso(roundedLatePenalty)}

        <br><br>

        <strong>
            Base Fee + Late Penalty:
        </strong>

        ${peso(rawTotalFee)}

        <br>

        <strong>
            Rounded Total Fee:
        </strong>

        ${peso(totalFee)}

        <br><br>

        <strong>
            CASH-IN:
        </strong>

        ${peso(cashIn)}

        <br>

        <strong>
            TOTAL TO PAY:
        </strong>

        ${peso(totalToPay)}

    `;


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


    const breakdown =
        getElement("breakdown");


    if (breakdown) {

        breakdown.innerHTML =
            breakdownHTML;

    }


    if (result) {

        result.style.display =
            "block";

    }


    /* =====================================================
       SAVE TRANSACTION
    ===================================================== */

    saveTransaction({

        id:
            createTransactionId(),

        date:
            new Date().toISOString(),

        customerName:
            customerName,

        cashIn:
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

        baseFee:
            baseFee,

        lateDays:
            lateDays,

        remainingHours:
            remainingHours,

        dayPenalty:
            dayPenalty,

        chargeableHours:
            chargeableHours,

        hourlyPenalty:
            hourlyPenalty,

        rawLatePenalty:
            rawLatePenalty,

        latePenalty:
            roundedLatePenalty,

        rawTotalFee:
            rawTotalFee,

        totalFee:
            totalFee,

        totalToPay:
            totalToPay,

        settled:
            settled

    });

}


/* =====================================================
   CREATE TRANSACTION ID
===================================================== */

function createTransactionId() {

    const timestamp =
        Date.now();


    const random =
        Math.floor(
            1000 +
            Math.random() * 9000
        );


    return (
        "TXN-" +
        timestamp +
        "-" +
        random
    );

}


/* =====================================================
   SAVE TRANSACTION
===================================================== */

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


/* =====================================================
   GET TRANSACTIONS
===================================================== */

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

    }

    catch (error) {

        console.error(
            "Database error:",
            error
        );


        return [];

    }

}


/* =====================================================
   SAVE TRANSACTIONS
===================================================== */

function saveTransactions(transactions) {

    localStorage.setItem(

        DATABASE_KEY,

        JSON.stringify(transactions)

    );

}


/* =====================================================
   DISPLAY DATABASE
===================================================== */

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
            transaction => {

                return String(
                    transaction.customerName || ""
                )
                .toLowerCase()
                .includes(search);

            }
        );


    if (count) {

        count.textContent =
            transactions.length;

    }


    table.innerHTML = "";


    if (
        filtered.length === 0
    ) {

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


/* =====================================================
   DELETE ONE TRANSACTION
===================================================== */

function deleteTransaction(id) {

    const confirmed =
        confirm(
            "Are you sure you want to delete this transaction?"
        );


    if (!confirmed) {

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


/* =====================================================
   DELETE ALL TRANSACTIONS
===================================================== */

function deleteAllRecords() {

    const transactions =
        getTransactions();


    if (
        transactions.length === 0
    ) {

        alert(
            "There are no transactions to delete."
        );

        return;

    }


    const confirmed =
        confirm(
            "WARNING: This will permanently delete ALL transactions from this browser. Continue?"
        );


    if (!confirmed) {

        return;

    }


    localStorage.removeItem(
        DATABASE_KEY
    );


    displayRecords();

}


/* =====================================================
   FORMAT DATE
===================================================== */

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


/* =====================================================
   ESCAPE HTML
===================================================== */

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


/* =====================================================
   SHOW ERROR
===================================================== */

function showError(message) {

    const errorMessage =
        getElement(
            "errorMessage"
        );


    if (!errorMessage) {

        alert(message);

        return;

    }


    errorMessage.textContent =
        message;


    errorMessage.style.display =
        "block";

}


/* =====================================================
   CLEAR CALCULATOR
===================================================== */

function clearCalculator() {

    const fields = [

        "customerName",

        "cashIn",

        "cashInTime",

        "paymentTime"

    ];


    fields.forEach(
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


    const error =
        getElement("errorMessage");


    if (error) {

        error.textContent = "";

        error.style.display =
            "none";

    }


    const result =
        getElement("result");


    if (result) {

        result.style.display =
            "none";

    }

}


/* =====================================================
   START
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        displayRecords();

    }
);