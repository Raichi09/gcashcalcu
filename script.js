const DATABASE_KEY = "cashin_transactions_v6";

const HOURS_PER_DAY = 24;
const FREE_HOURS = 4;

const HOURLY_RATE = 1;

const DAY_PENALTY = 2;

const HIGH_FIRST_DAY = 50;
const HIGH_NEXT_DAY = 30;


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


function calculateElapsed(start, end) {

    const difference = end.getTime() - start.getTime();

    if (difference < 0) {
        return null;
    }

    const totalMinutes = Math.floor(
        difference / (1000 * 60)
    );

    const totalHours = Math.floor(
        totalMinutes / 60
    );

    const minutes = totalMinutes % 60;

    const days = Math.floor(
        totalHours / HOURS_PER_DAY
    );

    const hours = totalHours % HOURS_PER_DAY;

    return {
        totalHours,
        days,
        hours,
        minutes
    };
}


function calculateFee() {

    const customerName =
        getElement("customerName").value.trim();

    const cashIn =
        parseFloat(getElement("cashIn").value);

    const cashInTime =
        getDateTime("cashInTime");

    const paymentTime =
        getDateTime("paymentTime");

    const settled =
        getElement("settled").checked;


    clearMessage();


    if (!customerName) {
        showError("Please enter the customer name.");
        return;
    }


    if (!Number.isFinite(cashIn) || cashIn <= 0) {
        showError("Please enter a valid cash-in amount.");
        return;
    }


    if (cashIn > 50000) {
        showError("Maximum transaction amount is ₱50,000.");
        return;
    }


    if (!cashInTime) {
        showError("Please enter the cash-in date and time.");
        return;
    }


    if (!paymentTime) {
        showError("Please enter the payment date and time.");
        return;
    }


    if (paymentTime < cashInTime) {
        showError(
            "Payment time cannot be earlier than cash-in time."
        );
        return;
    }


    const elapsed =
        calculateElapsed(cashInTime, paymentTime);


    if (!elapsed) {
        showError("Unable to calculate elapsed time.");
        return;
    }


    const totalHours =
        elapsed.totalHours;

    const lateDays =
        Math.floor(totalHours / HOURS_PER_DAY);

    const remainingHours =
        totalHours % HOURS_PER_DAY;


    if (totalHours > 0 && !settled) {

        showError(
            "NO SETTLEMENT, NO CASH-IN: Please settle the previous debt first."
        );

        return;
    }


    const baseFee =
        getBaseFee(cashIn);


    if (baseFee === null) {
        showError("Could not determine the base fee.");
        return;
    }


    let dayPenalty = 0;
    let chargeableHours = 0;
    let hourlyPenalty = 0;
    let rawLatePenalty = 0;
    let roundedLatePenalty = 0;


    /*
        BELOW ₱100
        NO LATE PENALTY
    */

    if (cashIn < 100) {

        dayPenalty = 0;
        chargeableHours = 0;
        hourlyPenalty = 0;
        rawLatePenalty = 0;
        roundedLatePenalty = 0;

    }


    /*
        ₱100 – ₱1,999

        First 4 hours FREE.

        Every completed 24 hours:
        ₱2 day penalty.

        Every chargeable hour:
        ₱1/hour.
    */

    else if (cashIn <= 1999) {

        dayPenalty =
            lateDays * DAY_PENALTY;


        const fullDayChargeableHours =
            lateDays *
            (HOURS_PER_DAY - FREE_HOURS);


        let extraChargeableHours = 0;


        if (remainingHours > FREE_HOURS) {

            extraChargeableHours =
                remainingHours - FREE_HOURS;

        }


        chargeableHours =
            fullDayChargeableHours +
            extraChargeableHours;


        hourlyPenalty =
            chargeableHours * HOURLY_RATE;


        rawLatePenalty =
            dayPenalty +
            hourlyPenalty;


        roundedLatePenalty =
            roundToFive(rawLatePenalty);

    }


    /*
        ₱2,000 AND ABOVE

        Day 1 = ₱50

        Day 2 onward = ₱30/day

        NO HOURLY PENALTY
    */

    else {

        chargeableHours = 0;
        hourlyPenalty = 0;


        if (lateDays >= 1) {

            dayPenalty =
                HIGH_FIRST_DAY +
                ((lateDays - 1) * HIGH_NEXT_DAY);

            rawLatePenalty =
                dayPenalty;

            roundedLatePenalty =
                roundToFive(rawLatePenalty);

        }

    }


    const rawTotalFee =
        baseFee + roundedLatePenalty;


    const totalFee =
        roundToFive(rawTotalFee);


    const totalToPay =
        cashIn + totalFee;


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

        <strong>Full Late Days:</strong>
        ${lateDays}

        <br>

        <strong>Day Penalty:</strong>
        ${peso(dayPenalty)}

        <br>

        <strong>Chargeable Hours:</strong>
        ${chargeableHours}

        <br>

        <strong>Hourly Rate:</strong>
        ${cashIn >= 100 && cashIn <= 1999
            ? "₱1.00/hour"
            : "None"
        }

        <br>

        <strong>Hourly Penalty:</strong>
        ${peso(hourlyPenalty)}

        <br>

        <strong>Late Penalty:</strong>
        ${peso(roundedLatePenalty)}

        <br>

        <strong>Final Fee:</strong>
        ${peso(totalFee)}

        <br><br>

        <strong>TOTAL TO PAY:</strong>
        ${peso(totalToPay)}
    `;


    getElement("result").style.display = "block";


    saveTransaction({

        id: createTransactionId(),

        date: new Date().toISOString(),

        customerName,

        cashIn,

        cashInTime: cashInTime.toISOString(),

        paymentTime: paymentTime.toISOString(),

        elapsedDays: elapsed.days,

        elapsedHours: elapsed.hours,

        elapsedMinutes: elapsed.minutes,

        completedHours: totalHours,

        lateDays,

        baseFee,

        remainingHours,

        dayPenalty,

        chargeableHours,

        hourlyPenalty,

        rawLatePenalty,

        latePenalty: roundedLatePenalty,

        rawTotalFee,

        totalFee,

        totalToPay,

        settled

    });

}


function createTransactionId() {

    return (
        "TXN-" +
        Date.now() +
        "-" +
        Math.floor(
            1000 + Math.random() * 9000
        )
    );
}


function saveTransaction(transaction) {

    const transactions =
        getTransactions();

    transactions.unshift(transaction);

    saveTransactions(transactions);

    displayRecords();
}


function getTransactions() {

    const saved =
        localStorage.getItem(DATABASE_KEY);


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

        console.error(error);

        return [];
    }
}


function saveTransactions(transactions) {

    localStorage.setItem(
        DATABASE_KEY,
        JSON.stringify(transactions)
    );
}


function displayRecords() {

    const table =
        getElement("transactionTable");

    const count =
        getElement("recordCount");


    if (!table) {
        return;
    }


    const transactions =
        getTransactions();


    const searchElement =
        getElement("searchInput");


    const search =
        searchElement
            ? searchElement.value.trim().toLowerCase()
            : "";


    const filtered =
        transactions.filter(transaction =>
            String(
                transaction.customerName || ""
            )
            .toLowerCase()
            .includes(search)
        );


    count.textContent =
        transactions.length;


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


    filtered.forEach(transaction => {

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
                ${peso(transaction.cashIn || 0)}
            </td>

            <td>
                ${formatDate(transaction.cashInTime)}
            </td>

            <td>
                ${formatDate(transaction.paymentTime)}
            </td>

            <td>
                ${transaction.completedHours ?? 0}
            </td>

            <td>
                ${peso(transaction.baseFee || 0)}
            </td>

            <td>
                ${peso(transaction.dayPenalty || 0)}
            </td>

            <td>
                ${transaction.chargeableHours ?? 0}
            </td>

            <td>
                ${peso(transaction.hourlyPenalty || 0)}
            </td>

            <td>
                ${peso(transaction.latePenalty || 0)}
            </td>

            <td>
                ${peso(transaction.totalFee || 0)}
            </td>

            <td>
                <strong>
                    ${peso(transaction.totalToPay || 0)}
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

    });
}


function deleteTransaction(id) {

    if (!confirm(
        "Are you sure you want to delete this transaction?"
    )) {
        return;
    }


    let transactions =
        getTransactions();


    transactions =
        transactions.filter(
            transaction =>
                transaction.id !== id
        );


    saveTransactions(transactions);

    displayRecords();
}


function deleteAllRecords() {

    const transactions =
        getTransactions();


    if (transactions.length === 0) {

        alert("There are no transactions to delete.");

        return;
    }


    if (!confirm(
        "WARNING: This will delete ALL transactions from this browser. Continue?"
    )) {
        return;
    }


    localStorage.removeItem(DATABASE_KEY);

    displayRecords();
}


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


function escapeHtml(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text == null ? "" : String(text);

    return div.innerHTML;
}


function showError(message) {

    const error =
        getElement("errorMessage");

    error.textContent = message;

    error.style.display = "block";
}


function clearMessage() {

    const error =
        getElement("errorMessage");

    error.textContent = "";

    error.style.display = "none";
}


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


    getElement("settled").checked = false;

    clearMessage();


    getElement("result").style.display =
        "none";
}


document.addEventListener(
    "DOMContentLoaded",
    function () {
        displayRecords();
    }
);
