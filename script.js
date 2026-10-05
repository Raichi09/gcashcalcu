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
        if (!data) return [];

        const transactions = JSON.parse(data);

        if (!Array.isArray(transactions)) {
            return [];
        }

        return transactions;
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

    if (amount >= 1 && amount <= 500) return 5;
    if (amount >= 501 && amount <= 1999) return 10;
    if (amount >= 2000 && amount <= 5000) return 15;
    if (amount >= 5001 && amount <= 9999) return 35;
    if (amount === 10000) return 60;

    return 0;
}

function countMidnights(start, end) {
    let count = 0;

    let current = new Date(start);
    const finish = new Date(end);

    current.setHours(24, 0, 0, 0);

    while (current <= finish) {
        count++;
        current.setDate(current.getDate() + 1);
    }

    return count;
}

function calculateTransaction(amount, cashInTime, paymentTime) {
    amount = Number(amount);

    if (!amount || amount <= 0) {
        throw new Error("Please enter a valid cash-in amount.");
    }

    if (amount > MAX_CASH_IN) {
        throw new Error("No cash-in / no utang above ₱10,000.");
    }

    const start = new Date(cashInTime);
    const end = new Date(paymentTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("Please enter both dates and times.");
    }

    if (end < start) {
        throw new Error("Payment time cannot be earlier than cash-in time.");
    }

    const difference = end.getTime() - start.getTime();

    const totalHours = Math.floor(
        difference / 3600000
    );

    const midnightCount = countMidnights(
        start,
        end
    );

    const baseFee = getBaseFee(amount);

    let dayPenalty = 0;
    let chargeableHours = 0;
    let hourPenalty = 0;
    let latePenalty = 0;

    if (amount < 100) {

        latePenalty = 0;

    } else if (amount <= 1999) {

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

    } else if (amount <= 4999) {

        if (midnightCount > 0) {
            dayPenalty =
                HIGH_FIRST_MIDNIGHT +
                ((midnightCount - 1) * HIGH_NEXT_MIDNIGHT);
        }

        latePenalty = dayPenalty;

    } else {

        if (midnightCount > 0) {
            dayPenalty =
                VERY_HIGH_FIRST_MIDNIGHT +
                ((midnightCount - 1) * VERY_HIGH_NEXT_MIDNIGHT);
        }

        latePenalty = dayPenalty;
    }

    const totalFee = Math.ceil(
        (baseFee + latePenalty) / 5
    ) * 5;

    const totalPay =
        amount + totalFee;

    return {
        cashIn: amount,
        baseFee,
        totalHours,
        midnightCount,
        dayPenalty,
        chargeableHours,
        hourPenalty,
        latePenalty,
        totalFee,
        totalPay
    };
}

function formatDate(value) {
    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    });
}

function formatElapsed(hours) {
    const days = Math.floor(hours / 24);
    const remaining = hours % 24;

    if (days > 0) {
        return days + " day(s) " + remaining + " hour(s)";
    }

    return hours + " hour(s)";
}

function showError(message) {
    const error = document.getElementById("errorMessage");
    const result = document.getElementById("result");

    error.textContent = message;
    error.style.display = "block";
    result.style.display = "none";
}

function hideError() {
    const error = document.getElementById("errorMessage");

    error.textContent = "";
    error.style.display = "none";
}

function calculateFee() {
    hideError();

    try {
        const customerName =
            document.getElementById("customerName").value.trim();

        const cashIn =
            Number(document.getElementById("cashIn").value);

        const cashInTime =
            document.getElementById("cashInTime").value;

        const paymentTime =
            document.getElementById("paymentTime").value;

        const settled =
            document.getElementById("settled").checked;

        if (!customerName) {
            throw new Error("Please enter the customer name.");
        }

        if (!cashIn) {
            throw new Error("Please enter the cash-in amount.");
        }

        if (!cashInTime) {
            throw new Error("Please enter the cash-in time.");
        }

        if (!paymentTime) {
            throw new Error("Please enter the payment / settlement time.");
        }

        if (cashIn > MAX_CASH_IN) {
            throw new Error("No cash-in / no utang above ₱10,000.");
        }

        const transactions = getTransactions();

        const unsettled = transactions.some(
            transaction => transaction.settled === false
        );

        if (unsettled && !settled) {
            throw new Error(
                "No Settlement, No Cash-In. Please settle the previous debt first."
            );
        }

        const result = calculateTransaction(
            cashIn,
            cashInTime,
            paymentTime
        );

        const transaction = {
            id: Date.now(),
            date: new Date().toISOString(),
            customerName: customerName,
            cashIn: result.cashIn,
            cashInTime: cashInTime,
            paymentTime: paymentTime,
            totalHours: result.totalHours,
            midnightCount: result.midnightCount,
            baseFee: result.baseFee,
            dayPenalty: result.dayPenalty,
            chargeableHours: result.chargeableHours,
            hourPenalty: result.hourPenalty,
            latePenalty: result.latePenalty,
            totalFee: result.totalFee,
            totalPay: result.totalPay,
            settled: settled
        };

        transactions.push(transaction);

        saveTransactions(transactions);

        displayResult(
            customerName,
            cashInTime,
            paymentTime,
            result
        );

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
    document.getElementById("resultName").textContent =
        customerName;

    document.getElementById("resultCashIn").textContent =
        peso(result.cashIn);

    document.getElementById("resultCashInTime").textContent =
        formatDate(cashInTime);

    document.getElementById("resultPaymentTime").textContent =
        formatDate(paymentTime);

    document.getElementById("resultElapsedTime").textContent =
        formatElapsed(result.totalHours);

    document.getElementById("resultCompletedHours").textContent =
        result.totalHours;

    document.getElementById("resultLateDays").textContent =
        result.midnightCount;

    document.getElementById("resultBaseFee").textContent =
        peso(result.baseFee);

    document.getElementById("resultDayPenalty").textContent =
        peso(result.dayPenalty);

    document.getElementById("resultChargeableHours").textContent =
        result.chargeableHours;

    document.getElementById("resultHourlyPenalty").textContent =
        peso(result.hourPenalty);

    document.getElementById("resultRawPenalty").textContent =
        peso(result.latePenalty);

    document.getElementById("resultPenalty").textContent =
        peso(Math.ceil(result.latePenalty / 5) * 5);

    document.getElementById("resultRawFee").textContent =
        peso(result.baseFee + result.latePenalty);

    document.getElementById("resultFee").textContent =
        peso(result.totalFee);

    document.getElementById("resultTotal").textContent =
        peso(result.totalPay);

    let text = "";

    if (result.cashIn < 100) {
        text =
            "<strong>Penalty:</strong> No late penalty.";
    } else if (result.cashIn <= 1999) {
        text =
            "<strong>Calculation:</strong><br>" +
            "Completed hours: " + result.totalHours +
            "<br>" +
            "Free hours: " + FREE_HOURS +
            "<br>" +
            "Chargeable hours: " + result.chargeableHours +
            "<br>" +
            "Hourly penalty: " + peso(result.hourPenalty) +
            "<br>" +
            "Midnight penalty: " + peso(result.dayPenalty) +
            "<br>" +
            "Total late penalty: " + peso(result.latePenalty);
    } else if (result.cashIn <= 4999) {
        text =
            "<strong>Calculation:</strong><br>" +
            "Midnights crossed: " + result.midnightCount +
            "<br>" +
            "Midnight penalty: " + peso(result.dayPenalty);
    } else {
        text =
            "<strong>Calculation:</strong><br>" +
            "Midnights crossed: " + result.midnightCount +
            "<br>" +
            "Midnight penalty: " + peso(result.dayPenalty);
    }

    document.getElementById("breakdown").innerHTML = text;
    document.getElementById("result").style.display = "block";
}

function displayRecords() {
    const table =
        document.getElementById("transactionTable");

    const count =
        document.getElementById("recordCount");

    const search =
        document.getElementById("searchInput")
            .value
            .trim()
            .toLowerCase();

    const transactions = getTransactions();

    count.textContent = transactions.length;

    table.innerHTML = "";

    const filtered = transactions.filter(transaction => {
        const name = String(
            transaction.customerName || ""
        ).toLowerCase();

        return name.includes(search);
    });

    if (filtered.length === 0) {
        table.innerHTML =
            '<tr><td colspan="14" class="empty-database">No transactions found.</td></tr>';
        return;
    }

    filtered.forEach(transaction => {

        const index =
            transactions.findIndex(
                item => item.id === transaction.id
            );

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${formatDate(transaction.date)}</td>
            <td>${escapeHtml(transaction.customerName || "")}</td>
            <td>${peso(transaction.cashIn)}</td>
            <td>${formatDate(transaction.cashInTime)}</td>
            <td>${formatDate(transaction.paymentTime)}</td>
            <td>${Number(transaction.totalHours) || 0}</td>
            <td>${peso(transaction.baseFee)}</td>
            <td>${peso(transaction.dayPenalty)}</td>
            <td>${Number(transaction.chargeableHours) || 0}</td>
            <td>${peso(transaction.hourPenalty)}</td>
            <td>${peso(transaction.latePenalty)}</td>
            <td>${peso(transaction.totalFee)}</td>
            <td>${peso(transaction.totalPay)}</td>
            <td>
                <button
                    type="button"
                    class="delete-btn"
                    onclick="deleteRecord(${index})"
                >
                    DELETE
                </button>
            </td>
        `;

        table.appendChild(row);
    });
}

function deleteRecord(index) {
    const transactions = getTransactions();

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
    const transactions = getTransactions();

    if (transactions.length === 0) {
        return;
    }

    if (!confirm("Delete all transaction records?")) {
        return;
    }

    localStorage.removeItem(DATABASE_KEY);

    displayRecords();

    document.getElementById("result").style.display = "none";
}

function clearCalculator() {
    document.getElementById("customerName").value = "";
    document.getElementById("cashIn").value = "";
    document.getElementById("cashInTime").value = "";
    document.getElementById("paymentTime").value = "";
    document.getElementById("settled").checked = false;

    hideError();

    document.getElementById("result").style.display = "none";
}

function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
}

window.addEventListener("load", function() {
    displayRecords();
});
