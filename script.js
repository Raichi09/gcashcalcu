
const DATABASE_KEY = "cashin_transactions_v9";

const FREE_HOURS = 4;
const HOURLY_RATE = 1;

const MIDNIGHT_PENALTY = 2;

const HIGH_FIRST_MIDNIGHT = 50;
const HIGH_NEXT_MIDNIGHT = 30;

const VERY_HIGH_FIRST_MIDNIGHT = 100;
const VERY_HIGH_NEXT_MIDNIGHT = 50;

const MAX_CASH_IN = 10000;

function peso(amount) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
}

function getTransactions() {
    try {
        const data = localStorage.getItem(DATABASE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        return [];
    }
}

function saveTransactions(transactions) {
    localStorage.setItem(
        DATABASE_KEY,
        JSON.stringify(transactions)
    );
}

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

function countMidnights(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
        isNaN(start.getTime()) ||
        isNaN(end.getTime()) ||
        end <= start
    ) {
        return 0;
    }

    let count = 0;

    const midnight = new Date(start);
    midnight.setHours(24, 0, 0, 0);

    while (midnight <= end) {
        count++;
        midnight.setDate(midnight.getDate() + 1);
    }

    return count;
}

function calculatePenalty(
    cashIn,
    cashInTime,
    paymentTime
) {
    const start = new Date(cashInTime);
    const end = new Date(paymentTime);

    if (
        isNaN(start.getTime()) ||
        isNaN(end.getTime())
    ) {
        return null;
    }

    if (end < start) {
        return null;
    }

    const milliseconds = end - start;

    const totalHours = Math.floor(
        milliseconds / (1000 * 60 * 60)
    );

    const midnightCount = countMidnights(
        start,
        end
    );

    let dayPenalty = 0;
    let chargeableHours = 0;
    let hourPenalty = 0;
    let latePenalty = 0;

    if (cashIn < 100) {

        latePenalty = 0;

    } else if (
        cashIn >= 100 &&
        cashIn <= 1999
    ) {

        chargeableHours = Math.max(
            totalHours - FREE_HOURS,
            0
        );

        hourPenalty =
            chargeableHours * HOURLY_RATE;

        dayPenalty =
            midnightCount * MIDNIGHT_PENALTY;

        latePenalty =
            hourPenalty + dayPenalty;

    } else if (
        cashIn >= 2000 &&
        cashIn <= 4999
    ) {

        if (midnightCount > 0) {
            dayPenalty =
                HIGH_FIRST_MIDNIGHT +
                (
                    midnightCount - 1
                ) * HIGH_NEXT_MIDNIGHT;
        }

        latePenalty = dayPenalty;

    } else if (
        cashIn >= 5000 &&
        cashIn <= 10000
    ) {

        if (midnightCount > 0) {
            dayPenalty =
                VERY_HIGH_FIRST_MIDNIGHT +
                (
                    midnightCount - 1
                ) * VERY_HIGH_NEXT_MIDNIGHT;
        }

        latePenalty = dayPenalty;
    }

    return {
        totalHours,
        midnightCount,
        dayPenalty,
        chargeableHours,
        hourPenalty,
        latePenalty
    };
}

function calculateTransaction(
    cashIn,
    cashInTime,
    paymentTime
) {
    cashIn = Number(cashIn);

    if (!Number.isFinite(cashIn)) {
        throw new Error(
            "Please enter a valid cash-in amount."
        );
    }

    if (cashIn <= 0) {
        throw new Error(
            "Cash-in amount must be greater than ₱0."
        );
    }

    if (cashIn > MAX_CASH_IN) {
        throw new Error(
            "No cash-in / no utang above ₱10,000."
        );
    }

    const baseFee = getBaseFee(cashIn);

    const penalty = calculatePenalty(
        cashIn,
        cashInTime,
        paymentTime
    );

    if (!penalty) {
        throw new Error(
            "Please enter valid cash-in and payment times."
        );
    }

    const rawLatePenalty =
        penalty.latePenalty;

    const roundedLatePenalty =
        Math.ceil(rawLatePenalty / 5) * 5;

    const rawTotalFee =
        baseFee + rawLatePenalty;

    const totalFee =
        Math.ceil(rawTotalFee / 5) * 5;

    const totalPay =
        cashIn + totalFee;

    return {
        cashIn,
        baseFee,
        totalHours: penalty.totalHours,
        midnightCount: penalty.midnightCount,
        dayPenalty: penalty.dayPenalty,
        chargeableHours: penalty.chargeableHours,
        hourPenalty: penalty.hourPenalty,
        rawLatePenalty,
        roundedLatePenalty,
        rawTotalFee,
        totalFee,
        totalPay
    };
}

function formatDate(date) {
    const value = new Date(date);

    if (isNaN(value.getTime())) {
        return "-";
    }

    return value.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

function formatElapsedTime(hours) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;

    if (days > 0) {
        return (
            days +
            " day(s) " +
            remainingHours +
            " hour(s)"
        );
    }

    return hours + " hour(s)";
}

function showError(message) {
    const error = document.getElementById(
        "errorMessage"
    );

    error.textContent = message;
    error.style.display = "block";

    const result = document.getElementById("result");
    result.style.display = "none";
}

function hideError() {
    const error = document.getElementById(
        "errorMessage"
    );

    error.textContent = "";
    error.style.display = "none";
}

function calculateFee() {
    hideError();

    const customerName =
        document.getElementById(
            "customerName"
        ).value.trim();

    const cashIn =
        Number(
            document.getElementById(
                "cashIn"
            ).value
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

    try {

        if (!customerName) {
            throw new Error(
                "Please enter the customer name."
            );
        }

        if (!cashIn) {
            throw new Error(
                "Please enter the cash-in amount."
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

        const start = new Date(cashInTime);
        const end = new Date(paymentTime);

        if (end < start) {
            throw new Error(
                "Payment time cannot be earlier than cash-in time."
            );
        }

        const transactions = getTransactions();

        const hasUnsettledDebt =
            transactions.some(
                transaction =>
                    transaction.settled === false
            );

        if (
            hasUnsettledDebt &&
            !settled
        ) {
            throw new Error(
                "No Settlement, No Cash-In. Please settle the previous debt first."
            );
        }

        const result =
            calculateTransaction(
                cashIn,
                cashInTime,
                paymentTime
            );

        displayResult(
            customerName,
            cashInTime,
            paymentTime,
            result
        );

        const transaction = {
            id: Date.now(),
            date: new Date().toISOString(),
            customerName,
            cashIn: result.cashIn,
            cashInTime,
            paymentTime,
            totalHours: result.totalHours,
            midnightCount: result.midnightCount,
            baseFee: result.baseFee,
            dayPenalty: result.dayPenalty,
            chargeableHours:
                result.chargeableHours,
            hourPenalty:
                result.hourPenalty,
            rawLatePenalty:
                result.rawLatePenalty,
            latePenalty:
                result.roundedLatePenalty,
            rawTotalFee:
                result.rawTotalFee,
            totalFee:
                result.totalFee,
            totalPay:
                result.totalPay,
            settled
        };

        transactions.push(transaction);

        saveTransactions(transactions);

        displayRecords();

    } catch (error) {
        showError(error.message);
    }
}

function displayResult(
    customerName,
    cashInTime,
    paymentTime,
    result
) {
    document.getElementById(
        "resultName"
    ).textContent = customerName;

    document.getElementById(
        "resultCashIn"
    ).textContent = peso(
        result.cashIn
    );

    document.getElementById(
        "resultCashInTime"
    ).textContent = formatDate(
        cashInTime
    );

    document.getElementById(
        "resultPaymentTime"
    ).textContent = formatDate(
        paymentTime
    );

    document.getElementById(
        "resultElapsedTime"
    ).textContent =
        formatElapsedTime(
            result.totalHours
        );

    document.getElementById(
        "resultCompletedHours"
    ).textContent =
        result.totalHours;

    document.getElementById(
        "resultLateDays"
    ).textContent =
        result.midnightCount;

    document.getElementById(
        "resultBaseFee"
    ).textContent =
        peso(result.baseFee);

    document.getElementById(
        "resultDayPenalty"
    ).textContent =
        peso(result.dayPenalty);

    document.getElementById(
        "resultChargeableHours"
    ).textContent =
        result.chargeableHours;

    document.getElementById(
        "resultHourlyPenalty"
    ).textContent =
        peso(result.hourPenalty);

    document.getElementById(
        "resultRawPenalty"
    ).textContent =
        peso(result.rawLatePenalty);

    document.getElementById(
        "resultPenalty"
    ).textContent =
        peso(result.roundedLatePenalty);

    document.getElementById(
        "resultRawFee"
    ).textContent =
        peso(result.rawTotalFee);

    document.getElementById(
        "resultFee"
    ).textContent =
        peso(result.totalFee);

    document.getElementById(
        "resultTotal"
    ).textContent =
        peso(result.totalPay);

    let breakdown = "";

    if (result.cashIn < 100) {

        breakdown =
            "<strong>Penalty:</strong> No late penalty.";

    } else if (
        result.cashIn >= 100 &&
        result.cashIn <= 1999
    ) {

        breakdown =
            "<strong>Calculation:</strong><br>" +
            result.totalHours +
            " completed hour(s)<br>" +
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
            "Late penalty: " +
            peso(result.rawLatePenalty);

    } else if (
        result.cashIn >= 2000 &&
        result.cashIn <= 4999
    ) {

        breakdown =
            "<strong>Calculation:</strong><br>" +
            "Midnights crossed: " +
            result.midnightCount +
            "<br>" +
            "Midnight penalty: " +
            peso(result.dayPenalty);

    } else {

        breakdown =
            "<strong>Calculation:</strong><br>" +
            "Midnights crossed: " +
            result.midnightCount +
            "<br>" +
            "Midnight penalty: " +
            peso(result.dayPenalty);
    }

    document.getElementById(
        "breakdown"
    ).innerHTML = breakdown;

    document.getElementById(
        "result"
    ).style.display = "block";

    document.getElementById(
        "result"
    ).scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function displayRecords() {

    const table =
        document.getElementById(
            "transactionTable"
        );

    const count =
        document.getElementById(
            "recordCount"
        );

    const search =
        document.getElementById(
            "searchInput"
        ).value
            .trim()
            .toLowerCase();

    const transactions =
        getTransactions();

    const filtered =
        transactions.filter(
            transaction =>
                transaction.customerName
                    .toLowerCase()
                    .includes(search)
        );

    count.textContent =
        transactions.length;

    table.innerHTML = "";

    if (filtered.length === 0) {

        const row =
            document.createElement("tr");

        row.innerHTML =
            '<td colspan="14" class="empty-database">No transactions found.</td>';

        table.appendChild(row);

        return;
    }

    filtered.forEach(
        transaction => {

            const originalIndex =
                transactions.findIndex(
                    item =>
                        item.id ===
                        transaction.id
                );

            const row =
                document.createElement("tr");

            row.innerHTML = `
                <td>${formatDate(transaction.date)}</td>
                <td>${escapeHtml(transaction.customerName)}</td>
                <td>${peso(transaction.cashIn)}</td>
                <td>${formatDate(transaction.cashInTime)}</td>
                <td>${formatDate(transaction.paymentTime)}</td>
                <td>${transaction.totalHours}</td>
                <td>${peso(transaction.baseFee)}</td>
                <td>${peso(transaction.dayPenalty)}</td>
                <td>${transaction.chargeableHours}</td>
                <td>${peso(transaction.hourPenalty)}</td>
                <td>${peso(transaction.latePenalty)}</td>
                <td>${peso(transaction.totalFee)}</td>
                <td>${peso(transaction.totalPay)}</td>
                <td>
                    <button
                        type="button"
                        class="delete-btn"
                        onclick="deleteRecord(${originalIndex})"
                    >
                        DELETE
                    </button>
                </td>
            `;

            table.appendChild(row);
        }
    );
}

function deleteRecord(index) {

    const transactions =
        getTransactions();

    if (
        index < 0 ||
        index >= transactions.length
    ) {
        return;
    }

    transactions.splice(index, 1);

    saveTransactions(transactions);

    displayRecords();
}

function deleteAllRecords() {

    const transactions =
        getTransactions();

    if (transactions.length === 0) {
        return;
    }

    const confirmed =
        confirm(
            "Delete all transaction records?"
        );

    if (!confirmed) {
        return;
    }

    localStorage.removeItem(
        DATABASE_KEY
    );

    displayRecords();

    document.getElementById(
        "result"
    ).style.display = "none";
}

function clearCalculator() {

    document.getElementById(
        "customerName"
    ).value = "";

    document.getElementById(
        "cashIn"
    ).value = "";

    document.getElementById(
        "cashInTime"
    ).value = "";

    document.getElementById(
        "paymentTime"
    ).value = "";

    document.getElementById(
        "settled"
    ).checked = false;

    hideError();

    document.getElementById(
        "result"
    ).style.display = "none";
}

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value;

    return div.innerHTML;
}

document.addEventListener(
    "DOMContentLoaded",
    function () {

        document.getElementById(
            "calculateBtn"
        ).addEventListener(
            "click",
            calculateFee
        );

        document.getElementById(
            "clearBtn"
        ).addEventListener(
            "click",
            clearCalculator
        );

        document.getElementById(
            "deleteAllBtn"
        ).addEventListener(
            "click",
            deleteAllRecords
        );

        document.getElementById(
            "searchInput"
        ).addEventListener(
            "input",
            displayRecords
        );

        displayRecords();
    }
);

