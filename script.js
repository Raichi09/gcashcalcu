const DATABASE_KEY = "cashin_transactions_v7";

const FREE_HOURS = 4;
const HOURLY_RATE = 1;

const MIDNIGHT_PENALTY = 2;

const HIGH_FIRST_MIDNIGHT = 50;
const HIGH_NEXT_MIDNIGHT = 30;


/* =========================
   BASIC HELPERS
========================= */

function roundToFive(amount) {
    return Math.round(amount / 5) * 5;
}


function peso(amount) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}


function getElement(id) {
    return document.getElementById(id);
}


function setText(id, value) {
    const element = getElement(id);

    if (element) {
        element.textContent = value;
    }
}


/* =========================
   BASE FEE
========================= */

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


/* =========================
   DATE / TIME
========================= */

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


/* =========================
   ELAPSED TIME
========================= */

function calculateElapsed(start, end) {

    const difference =
        end.getTime() - start.getTime();

    if (difference < 0) {
        return null;
    }

    const totalMinutes =
        Math.floor(difference / (1000 * 60));

    const totalHours =
        Math.floor(totalMinutes / 60);

    const minutes =
        totalMinutes % 60;

    const days =
        Math.floor(totalHours / 24);

    const hours =
        totalHours % 24;

    return {
        totalHours,
        days,
        hours,
        minutes
    };
}


/* =========================
   MIDNIGHT COUNTER
========================= */

/*
    IMPORTANT:

    This does NOT wait 24 hours.

    It counts how many calendar midnights
    were crossed.

    Example:

    4:00 PM -> 12:00 AM
    = 1 midnight

    4:00 PM -> 1:00 AM
    = 1 midnight

    4:00 PM -> next day 12:00 AM
    = 2 midnights

    The penalty is based on midnight crossings.
*/

function countMidnights(start, end) {

    if (end <= start) {
        return 0;
    }

    let count = 0;

    const midnight = new Date(start);

    midnight.setHours(24, 0, 0, 0);

    while (midnight <= end) {

        count++;

        midnight.setDate(
            midnight.getDate() + 1
        );
    }

    return count;
}


/* =========================
   CALCULATE FEE
========================= */

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


    /* CUSTOMER */

    if (!customerName) {

        showError(
            "Please enter the customer name."
        );

        return;
    }


    /* AMOUNT */

    if (!Number.isFinite(cashIn) || cashIn <= 0) {

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


    /* CASH-IN TIME */

    if (!cashInTime) {

        showError(
            "Please enter the cash-in date and time."
        );

        return;
    }


    /* PAYMENT TIME */

    if (!paymentTime) {

        showError(
            "Please enter the payment date and time."
        );

        return;
    }


    /* TIME VALIDATION */

    if (paymentTime < cashInTime) {

        showError(
            "Payment time cannot be earlier than cash-in time."
        );

        return;
    }


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


    /*
        NEW RULE:

        Count calendar midnights,
        NOT 24-hour periods.
    */

    const midnightCount =
        countMidnights(
            cashInTime,
            paymentTime
        );


    /*
        Settlement check.

        If there is an actual waiting period,
        settlement must be checked.
    */

    if (totalHours > 0 && !settled) {

        showError(
            "NO SETTLEMENT, NO CASH-IN: Please settle the previous debt first."
        );

        return;
    }


    const baseFee =
        getBaseFee(cashIn);


    if (baseFee === null) {

        showError(
            "Could not determine the base fee."
        );

        return;
    }


    let dayPenalty = 0;

    let chargeableHours = 0;

    let hourlyPenalty = 0;

    let rawLatePenalty = 0;

    let roundedLatePenalty = 0;


    /* =========================
       BELOW ₱100
    ========================= */

    if (cashIn < 100) {

        dayPenalty = 0;

        chargeableHours = 0;

        hourlyPenalty = 0;

        rawLatePenalty = 0;

        roundedLatePenalty = 0;
    }


    /* =========================
       ₱100 - ₱1,999
    ========================= */

    else if (cashIn <= 1999) {

        /*
            FIRST 4 HOURS FREE.

            Example:

            4 PM -> 8 PM
            = 4 hours
            = ₱0 hourly

            4 PM -> 9 PM
            = 5 hours
            = ₱1 hourly
        */

        if (totalHours > FREE_HOURS) {

            chargeableHours =
                totalHours - FREE_HOURS;

        } else {

            chargeableHours = 0;
        }


        hourlyPenalty =
            chargeableHours * HOURLY_RATE;


        /*
            ₱2 FOR EACH MIDNIGHT CROSSED.
        */

        dayPenalty =
            midnightCount * MIDNIGHT_PENALTY;


        rawLatePenalty =
            dayPenalty +
            hourlyPenalty;


        roundedLatePenalty =
            roundToFive(
                rawLatePenalty
            );
    }


    /* =========================
       ₱2,000 AND ABOVE
    ========================= */

    else {

        chargeableHours = 0;

        hourlyPenalty = 0;


        /*
            FIRST MIDNIGHT = ₱50

            SECOND MIDNIGHT = ₱30

            THIRD MIDNIGHT = ₱30
        */

        if (midnightCount >= 1) {

            dayPenalty =
                HIGH_FIRST_MIDNIGHT +
                (
                    (midnightCount - 1) *
                    HIGH_NEXT_MIDNIGHT
                );

        } else {

            dayPenalty = 0;
        }


        rawLatePenalty =
            dayPenalty;


        roundedLatePenalty =
            roundToFive(
                rawLatePenalty
            );
    }


    /* =========================
       FINAL TOTAL
    ========================= */

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


    /* =========================
       DISPLAY RESULT
    ========================= */

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
        `${elapsed.days} day(s), ${elapsed.hours} hour(s), ${elapsed.minutes} minute(s)`
    );


    setText(
        "resultCompletedHours",
        totalHours
    );


    setText(
        "resultLateDays",
        midnightCount
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


    /* =========================
       BREAKDOWN
    ========================= */

    const breakdown =
        getElement("breakdown");


    if (breakdown) {

        breakdown.innerHTML = `

            <div class="breakdown-title">
                Fee Calculation Breakdown
            </div>

            <strong>Cash-In:</strong>
            ${peso(cashIn)}

            <br>

            <strong>Base Fee:</strong>
            ${peso(baseFee)}

            <br>

            <strong>Elapsed:</strong>
            ${elapsed.days} day(s),
            ${elapsed.hours} hour(s),
            ${elapsed.minutes} minute(s)

            <br>

            <strong>Completed Hours:</strong>
            ${totalHours}

            <br>

            <strong>Midnights Crossed:</strong>
            ${midnightCount}

            <br>

            <strong>Midnight Penalty:</strong>
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

            <br>

            <strong>Raw Late Penalty:</strong>
            ${peso(rawLatePenalty)}

            <br>

            <strong>Rounded Late Penalty:</strong>
            ${peso(roundedLatePenalty)}

            <br>

            <strong>Final Fee:</strong>
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


    /* =========================
       SAVE
    ========================= */

    saveTransaction({

        id: createTransactionId(),

        date: new Date().toISOString(),

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

        /*
            This now means:
            number of calendar midnights crossed.
        */

        lateDays:
            midnightCount,

        midnightCount,

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


/* =========================
   TRANSACTION ID
========================= */

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


/* =========================
   SAVE
========================= */

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


/* =========================
   GET DATABASE
========================= */

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


/* =========================
   SAVE DATABASE
========================= */

function saveTransactions(transactions) {

    try {

        localStorage.setItem(
            DATABASE_KEY,
            JSON.stringify(
                transactions
            )
        );

    } catch (error) {

        console.error(
            "Could not save transactions:",
            error
        );

        showError(
            "Could not save transaction to this browser."
        );
    }
}


/* =========================
   DISPLAY DATABASE
========================= */

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
                    transaction.customerName || ""
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
                    ${
                        transaction.completedHours ??
                        0
                    }
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
                    ${
                        transaction.chargeableHours ??
                        0
                    }
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


/* =========================
   DELETE ONE
========================= */

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


/* =========================
   DELETE ALL
========================= */

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


/* =========================
   FORMAT DATE
========================= */

function formatDate(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (isNaN(date.getTime())) {
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


/* =========================
   ESCAPE HTML
========================= */

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


/* =========================
   ERROR
========================= */

function showError(message) {

    const error =
        getElement(
            "errorMessage"
        );


    if (!error) {
        return;
    }


    error.textContent =
        message;


    error.style.display =
        "block";
}


/* =========================
   CLEAR ERROR
========================= */

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


/* =========================
   CLEAR CALCULATOR
========================= */

function clearCalculator() {

    [
        "customerName",
        "cashIn",
        "cashInTime",
        "paymentTime"
    ].forEach(id => {

        const element =
            getElement(id);


        if (element) {
            element.value = "";
        }

    });


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


/* =========================
   PAGE LOAD
========================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        displayRecords();

    }
);
