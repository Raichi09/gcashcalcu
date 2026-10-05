const DATABASE_KEY = "cashin_transactions_v10";

const FREE_HOURS = 4;
const HOURLY_RATE = 1;
const MIDNIGHT_PENALTY = 2;

const HIGH_FIRST_MIDNIGHT = 50;
const HIGH_NEXT_MIDNIGHT = 30;

const VERY_HIGH_FIRST_MIDNIGHT = 100;
const VERY_HIGH_NEXT_MIDNIGHT = 50;

const MAX_CASH_IN = 10000;

/* =========================
MONEY
========================= */

function peso(amount) {

const value = Number(amount) || 0;

return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
}).format(value);

}

/* =========================
DATABASE
========================= */

function getTransactions() {

try {

    const data =
        localStorage.getItem(DATABASE_KEY);

    if (!data) {
        return [];
    }

    const transactions =
        JSON.parse(data);

    if (!Array.isArray(transactions)) {
        return [];
    }

    return transactions.map(
        (transaction, index) => ({

            id:
                transaction.id ||
                Date.now() + index,

            date:
                transaction.date ||
                new Date().toISOString(),

            customerName:
                String(
                    transaction.customerName || ""
                ),

            cashIn:
                Number(
                    transaction.cashIn
                ) || 0,

            cashInTime:
                transaction.cashInTime || "",

            paymentTime:
                transaction.paymentTime || "",

            totalHours:
                Number(
                    transaction.totalHours
                ) || 0,

            midnightCount:
                Number(
                    transaction.midnightCount
                ) || 0,

            baseFee:
                Number(
                    transaction.baseFee
                ) || 0,

            dayPenalty:
                Number(
                    transaction.dayPenalty
                ) || 0,

            chargeableHours:
                Number(
                    transaction.chargeableHours
                ) || 0,

            hourPenalty:
                Number(
                    transaction.hourPenalty
                ) || 0,

            latePenalty:
                Number(
                    transaction.latePenalty
                ) || 0,

            rawFee:
                Number(
                    transaction.rawFee
                ) || 0,

            totalFee:
                Number(
                    transaction.totalFee
                ) || 0,

            totalPay:
                Number(
                    transaction.totalPay
                ) || 0,

            settled:
                transaction.settled === true

        })
    );

} catch (error) {

    console.error(
        "Database read error:",
        error
    );

    return [];
}

}

function saveTransactions(transactions) {

try {

    localStorage.setItem(
        DATABASE_KEY,
        JSON.stringify(transactions)
    );

    return true;

} catch (error) {

    console.error(
        "Database save error:",
        error
    );

    showError(
        "Unable to save the database on this device."
    );

    return false;
}

}

/* =========================
BASE FEE
========================= */

function getBaseFee(amount) {

amount = Number(amount);

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

if (amount === 10000) {
    return 60;
}

return 0;

}

/* =========================
MIDNIGHTS
========================= */

function countMidnights(start, end) {

let count = 0;

const current = new Date(start);
const finish = new Date(end);

if (
    isNaN(current.getTime()) ||
    isNaN(finish.getTime())
) {
    return 0;
}

current.setHours(
    24,
    0,
    0,
    0
);

while (current <= finish) {

    count++;

    current.setDate(
        current.getDate() + 1
    );
}

return count;

}

/* =========================
TRANSACTION CALCULATION
========================= */

function calculateTransaction(
amount,
cashInTime,
paymentTime
) {

amount = Number(amount);

if (
    !Number.isFinite(amount) ||
    amount <= 0
) {

    throw new Error(
        "Please enter a valid cash-in amount."
    );
}

if (amount > MAX_CASH_IN) {

    throw new Error(
        "No cash-in / no utang above ₱10,000."
    );
}

const start =
    new Date(cashInTime);

const end =
    new Date(paymentTime);

if (
    isNaN(start.getTime()) ||
    isNaN(end.getTime())
) {

    throw new Error(
        "Please enter both dates and times."
    );
}

if (end < start) {

    throw new Error(
        "Payment time cannot be earlier than cash-in time."
    );
}

const difference =
    end.getTime() -
    start.getTime();

const totalHours =
    Math.floor(
        difference / 3600000
    );

const midnightCount =
    countMidnights(
        start,
        end
    );

const baseFee =
    getBaseFee(amount);

let dayPenalty = 0;
let chargeableHours = 0;
let hourPenalty = 0;
let latePenalty = 0;

if (amount < 100) {

    latePenalty = 0;

} else if (amount <= 1999) {

    chargeableHours =
        Math.max(
            totalHours - FREE_HOURS,
            0
        );

    hourPenalty =
        chargeableHours *
        HOURLY_RATE;

    dayPenalty =
        midnightCount *
        MIDNIGHT_PENALTY;

    latePenalty =
        hourPenalty +
        dayPenalty;

} else if (amount <= 4999) {

    if (midnightCount > 0) {

        dayPenalty =
            HIGH_FIRST_MIDNIGHT +
            (
                (midnightCount - 1) *
                HIGH_NEXT_MIDNIGHT
            );
    }

    latePenalty =
        dayPenalty;

} else {

    if (midnightCount > 0) {

        dayPenalty =
            VERY_HIGH_FIRST_MIDNIGHT +
            (
                (midnightCount - 1) *
                VERY_HIGH_NEXT_MIDNIGHT
            );
    }

    latePenalty =
        dayPenalty;
}

const rawFee =
    baseFee +
    latePenalty;

const totalFee =
    Math.ceil(
        rawFee / 5
    ) * 5;

const totalPay =
    amount +
    totalFee;

return {

    cashIn: amount,

    baseFee: baseFee,

    totalHours: totalHours,

    midnightCount: midnightCount,

    dayPenalty: dayPenalty,

    chargeableHours: chargeableHours,

    hourPenalty: hourPenalty,

    latePenalty: latePenalty,

    rawFee: rawFee,

    totalFee: totalFee,

    totalPay: totalPay
};

}

/* =========================
DATE
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
ELAPSED
========================= */

function formatElapsed(hours) {

hours =
    Number(hours) || 0;

const days =
    Math.floor(hours / 24);

const remaining =
    hours % 24;

if (days > 0) {

    return (
        days +
        " day(s) " +
        remaining +
        " hour(s)"
    );
}

return (
    hours +
    " hour(s)"
);

}

/* =========================
ERROR
========================= */

function showError(message) {

const error =
    document.getElementById(
        "errorMessage"
    );

const result =
    document.getElementById(
        "result"
    );

if (error) {

    error.textContent =
        message;

    error.style.display =
        "block";
}

if (result) {

    result.style.display =
        "none";
}

}

function hideError() {

const error =
    document.getElementById(
        "errorMessage"
    );

if (error) {

    error.textContent = "";

    error.style.display =
        "none";
}

}

/* =========================
CALCULATE & SAVE
========================= */

function calculateFee() {

hideError();

try {

    const customerName =
        document
            .getElementById(
                "customerName"
            )
            .value
            .trim();

    const cashIn =
        Number(
            document
                .getElementById(
                    "cashIn"
                )
                .value
        );

    const cashInTime =
        document.getElementById(
            "cashInTime"
        ).value;

    const paymentTime =
        document.getElementById(
            "paymentTime"
        ).value;

    const settled =
        document.getElementById(
            "settled"
        ).checked;

    if (!customerName) {

        throw new Error(
            "Please enter the customer name."
        );
    }

    if (
        !Number.isFinite(cashIn) ||
        cashIn <= 0
    ) {

        throw new Error(
            "Please enter a valid cash-in amount."
        );
    }

    if (cashIn > MAX_CASH_IN) {

        throw new Error(
            "No cash-in / no utang above ₱10,000."
        );
    }

    if (!cashInTime) {

        throw new Error(
            "Please enter the cash-in time."
        );
    }

    if (!paymentTime) {

        throw new Error(
            "Please enter the payment / settlement time."
        );
    }

    const start =
        new Date(cashInTime);

    const end =
        new Date(paymentTime);

    if (
        isNaN(start.getTime()) ||
        isNaN(end.getTime())
    ) {

        throw new Error(
            "The date/time entered is invalid."
        );
    }

    if (end < start) {

        throw new Error(
            "Payment time cannot be earlier than cash-in time."
        );
    }

    const transactions =
        getTransactions();

    const unsettledTransactions =
        transactions.filter(
            transaction =>
                transaction.settled === false
        );

    if (
        unsettledTransactions.length > 0 &&
        !settled
    ) {

        throw new Error(
            "No Settlement, No Cash-In. Please settle the previous debt first."
        );
    }

    if (
        unsettledTransactions.length > 0 &&
        settled
    ) {

        transactions.forEach(
            transaction => {

                if (
                    transaction.settled === false
                ) {

                    transaction.settled = true;
                }
            }
        );
    }

    const result =
        calculateTransaction(
            cashIn,
            cashInTime,
            paymentTime
        );

    const transaction = {

        id: createId(),

        date:
            new Date().toISOString(),

        customerName:

            customerName,

        cashIn:
            result.cashIn,

        cashInTime:
            cashInTime,

        paymentTime:
            paymentTime,

        totalHours:
            result.totalHours,

        midnightCount:
            result.midnightCount,

        baseFee:
            result.baseFee,

        dayPenalty:
            result.dayPenalty,

        chargeableHours:
            result.chargeableHours,

        hourPenalty:
            result.hourPenalty,

        latePenalty:
            result.latePenalty,

        rawFee:
            result.rawFee,

        totalFee:
            result.totalFee,

        totalPay:
            result.totalPay,

        settled:
            settled
    };

    transactions.push(
        transaction
    );

    if (
        !saveTransactions(
            transactions
        )
    ) {

        return;
    }

    displayResult(
        customerName,
        cashInTime,
        paymentTime,
        result
    );

    displayRecords();

    setTimeout(
        () => {

            const resultBox =
                document.getElementById(
                    "result"
                );

            if (resultBox) {

                resultBox.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }

        },
        100
    );

} catch (error) {

    console.error(error);

    showError(
        error.message ||
        "An error occurred."
    );
}

}

/* =========================
DISPLAY RESULT
========================= */

function displayResult(
customerName,
cashInTime,
paymentTime,
result
) {

setText(
    "resultName",
    customerName
);

setText(
    "resultCashIn",
    peso(result.cashIn)
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
    formatElapsed(result.totalHours)
);

setText(
    "resultCompletedHours",
    result.totalHours
);

setText(
    "resultLateDays",
    result.midnightCount
);

setText(
    "resultBaseFee",
    peso(result.baseFee)
);

setText(
    "resultDayPenalty",
    peso(result.dayPenalty)
);

setText(
    "resultChargeableHours",
    result.chargeableHours
);

setText(
    "resultHourlyPenalty",
    peso(result.hourPenalty)
);

setText(
    "resultRawPenalty",
    peso(result.latePenalty)
);

const roundedPenalty =
    Math.ceil(
        result.latePenalty / 5
    ) * 5;

setText(
    "resultPenalty",
    peso(roundedPenalty)
);

setText(
    "resultRawFee",
    peso(result.rawFee)
);

setText(
    "resultFee",
    peso(result.totalFee)
);

setText(
    "resultTotal",
    peso(result.totalPay)
);

let text = "";

if (result.cashIn < 100) {

    text =
        "<strong>Penalty:</strong> " +
        "No late penalty.";

} else if (result.cashIn <= 1999) {

    text =
        "<strong>Calculation:</strong><br>" +

        "Completed hours: " +
        result.totalHours +

        "<br>" +

        "Free hours: " +
        FREE_HOURS +

        "<br>" +

        "Chargeable hours: " +
        result.chargeableHours +

        "<br>" +

        "Hourly penalty: " +
        peso(result.hourPenalty) +

        "<br>" +

        "Midnight penalty: " +
        peso(result.dayPenalty) +

        "<br>" +

        "Raw late penalty: " +
        peso(result.latePenalty) +

        "<br>" +

        "Total fee: " +
        peso(result.totalFee);

} else {

    text =
        "<strong>Calculation:</strong><br>" +

        "Midnights crossed: " +
        result.midnightCount +

        "<br>" +

        "Midnight penalty: " +
        peso(result.dayPenalty) +

        "<br>" +

        "Total fee: " +
        peso(result.totalFee);
}

const breakdown =
    document.getElementById(
        "breakdown"
    );

if (breakdown) {
    breakdown.innerHTML = text;
}

const resultBox =
    document.getElementById(
        "result"
    );

if (resultBox) {

    resultBox.style.display =
        "block";
}

}

/* =========================
DATABASE DISPLAY
========================= */

function displayRecords() {

const table =
    document.getElementById(
        "transactionTable"
    );

const count =
    document.getElementById(
        "recordCount"
    );

const searchInput =
    document.getElementById(
        "searchInput"
    );

if (
    !table ||
    !count ||
    !searchInput
) {
    return;
}

const search =
    searchInput.value
        .trim()
        .toLowerCase();

const transactions =
    getTransactions();

count.textContent =
    transactions.length;

table.innerHTML = "";

const filtered =
    transactions.filter(
        transaction => {

            const name =
                String(
                    transaction.customerName || ""
                ).toLowerCase();

            return name.includes(search);
        }
    );

if (
    filtered.length === 0
) {

    table.innerHTML =
        '<tr>' +
        '<td colspan="14" class="empty-database">' +
        'No transactions found.' +
        '</td>' +
        '</tr>';

    return;
}

filtered.forEach(
    transaction => {

        const row =
            document.createElement("tr");

        row.innerHTML = `

            <td>
                ${formatDate(transaction.date)}
            </td>

            <td>
                ${escapeHtml(transaction.customerName)}
            </td>

            <td>
                ${peso(transaction.cashIn)}
            </td>

            <td>
                ${formatDate(transaction.cashInTime)}
            </td>

            <td>
                ${formatDate(transaction.paymentTime)}
            </td>

            <td>
                ${Number(transaction.totalHours) || 0}
            </td>

            <td>
                ${peso(transaction.baseFee)}
            </td>

            <td>
                ${peso(transaction.dayPenalty)}
            </td>

            <td>
                ${Number(transaction.chargeableHours) || 0}
            </td>

            <td>
                ${peso(transaction.hourPenalty)}
            </td>

            <td>
                ${peso(transaction.latePenalty)}
            </td>

            <td>
                ${peso(transaction.totalFee)}
            </td>

            <td>
                ${peso(transaction.totalPay)}
            </td>

            <td>
                <button
                    type="button"
                    class="delete-btn"
                    data-id="${transaction.id}"
                >
                    DELETE
                </button>
            </td>

        `;

        const deleteButton =
            row.querySelector(
                ".delete-btn"
            );

        deleteButton.addEventListener(
            "click",
            function() {

                deleteRecord(
                    transaction.id
                );

            }
        );

        table.appendChild(row);
    }
);

}

/* =========================
DELETE RECORD
========================= */

function deleteRecord(id) {

const transactions =
    getTransactions();

const index =
    transactions.findIndex(
        transaction =>
            String(transaction.id) ===
            String(id)
    );

if (index === -1) {
    return;
}

const customer =
    transactions[index]
        .customerName;

if (
    !confirm(
        "Delete transaction for " +
        customer +
        "?"
    )
) {
    return;
}

transactions.splice(
    index,
    1
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

if (
    transactions.length === 0
) {

    alert(
        "There are no transaction records."
    );

    return;
}

if (
    !confirm(
        "Delete ALL transaction records?\n\nThis cannot be undone unless you have a backup."
    )
) {
    return;
}

localStorage.removeItem(
    DATABASE_KEY
);

displayRecords();

const result =
    document.getElementById(
        "result"
    );

if (result) {

    result.style.display =
        "none";
}

}

/* =========================
CLEAR
========================= */

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
            document.getElementById(id);

        if (element) {
            element.value = "";
        }
    }
);

const settled =
    document.getElementById(
        "settled"
    );

if (settled) {
    settled.checked = false;
}

hideError();

const result =
    document.getElementById(
        "result"
    );

if (result) {
    result.style.display =
        "none";
}

}

/* =========================
BACKUP
========================= */

function backupDatabase() {

const transactions =
    getTransactions();

if (
    transactions.length === 0
) {

    alert(
        "There are no transactions to backup."
    );

    return;
}

const data =
    JSON.stringify(
        transactions,
        null,
        2
    );

const blob =
    new Blob(
        [data],
        {
            type:
                "application/json"
        }
    );

const url =
    URL.createObjectURL(blob);

const link =
    document.createElement("a");

const date =
    new Date()
        .toISOString()
        .slice(0, 10);

link.href = url;

link.download =
    "cashin-backup-" +
    date +
    ".json";

document.body.appendChild(link);

link.click();

document.body.removeChild(link);

URL.revokeObjectURL(url);

}

/* =========================
RESTORE
========================= */

function restoreDatabase(file) {

if (!file) {
    return;
}

const reader =
    new FileReader();

reader.onload =
    function(event) {

        try {

            const imported =
                JSON.parse(
                    event.target.result
                );

            if (
                !Array.isArray(imported)
            ) {

                throw new Error(
                    "Invalid backup file."
                );
            }

            if (
                !confirm(
                    "Restore " +
                    imported.length +
                    " transaction(s)?\n\nThis will replace the current database."
                )
            ) {
                return;
            }

            if (
                !saveTransactions(
                    imported
                )
            ) {
                return;
            }

            displayRecords();

            alert(
                "Database restored successfully."
            );

        } catch (error) {

            alert(
                "Could not restore backup:\n" +
                error.message
            );
        }
    };

reader.readAsText(file);

}

/* =========================
HELPERS
========================= */

function setText(id, value) {

const element =
    document.getElementById(id);

if (element) {

    element.textContent =
        value;
}

}

function escapeHtml(value) {

const div =
    document.createElement("div");

div.textContent =
    String(value || "");

return div.innerHTML;

}

function createId() {

return (
    Date.now().toString(36) +
    "-" +
    Math.random()
        .toString(36)
        .slice(2, 10)
);

}

/* =========================
START APP
========================= */

window.addEventListener(
"DOMContentLoaded",
function() {

    displayRecords();

}

);
