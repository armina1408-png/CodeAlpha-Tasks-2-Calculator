
const expressionDisplay = document.getElementById("expression");
const resultDisplay = document.getElementById("result");
const messageDisplay = document.getElementById("message");
const keypad = document.getElementById("keypad");
const particlesContainer = document.getElementById("particles");

let expression = "";
let justCalculated = false;
let errorMessage = "";
let lastValidPreview = null;

const OPERATORS = ["+", "-", "*", "/"];
const MAX_EXPRESSION_LENGTH = 180;

const isOperator = (char) => OPERATORS.includes(char);

function setMessage(message) {
    messageDisplay.textContent = message;
}

function normalizeExpression(value) {
    return value.replaceAll("×", "*").replaceAll("÷", "/");
}

function prettyExpression(value) {
    return value.replaceAll("*", "×").replaceAll("/", "÷");
}

function tokenize(input) {
    const tokens = [];
    let i = 0;

    while (i < input.length) {
        const char = input[i];

        if (/\s/.test(char)) {
            i++;
            continue;
        }

        if (/[0-9.]/.test(char)) {
            let number = "";
            let dots = 0;

            while (i < input.length && /[0-9.]/.test(input[i])) {
                if (input[i] === ".") dots++;

                if (dots > 1) {
                    throw new Error("Invalid decimal number");
                }

                number += input[i++];
            }

            if (number === ".") {
                throw new Error("Invalid decimal number");
            }

            const parsed = Number(number);

            if (!Number.isFinite(parsed)) {
                throw new Error("Invalid number");
            }

            tokens.push({ type: "number", value: parsed });
            continue;
        }

        if ("+-*/()".includes(char)) {
            tokens.push({ type: char, value: char });
            i++;
            continue;
        }

        throw new Error("Invalid character");
    }

    return tokens;
}

function evaluateExpression(input) {
    const tokens = tokenize(input);
    let position = 0;

    function peek() {
        return tokens[position];
    }

    function consume(type) {
        const token = peek();

        if (!token || token.type !== type) {
            throw new Error("Incomplete expression");
        }

        position++;
        return token;
    }

    function parsePrimary() {
        const token = peek();

        if (!token) {
            throw new Error("Incomplete expression");
        }

        if (token.type === "number") {
            position++;
            return token.value;
        }

        if (token.type === "(") {
            position++;
            const value = parseAddSub();
            consume(")");
            return value;
        }

        throw new Error("Expected a number");
    }

    function parseUnary() {
        if (peek()?.type === "+") {
            position++;
            return parseUnary();
        }

        if (peek()?.type === "-") {
            position++;
            return -parseUnary();
        }

        return parsePrimary();
    }

    function parseMultiplyDivide() {
        let value = parseUnary();

        while (peek() && ["*", "/"].includes(peek().type)) {
            const operator = tokens[position++].type;
            const right = parseUnary();

            if (operator === "*") {
                value *= right;
            } else {
                if (right === 0) {
                    throw new Error("Cannot divide by zero");
                }

                value /= right;
            }

            if (!Number.isFinite(value)) {
                throw new Error("Result is too large");
            }
        }

        return value;
    }

    function parseAddSub() {
        let value = parseMultiplyDivide();

        while (peek() && ["+", "-"].includes(peek().type)) {
            const operator = tokens[position++].type;
            const right = parseMultiplyDivide();

            value = operator === "+"
                ? value + right
                : value - right;

            if (!Number.isFinite(value)) {
                throw new Error("Result is too large");
            }
        }

        return value;
    }

    if (tokens.length === 0) {
        throw new Error("Enter a calculation");
    }

    const value = parseAddSub();

    if (position !== tokens.length) {
        throw new Error("Invalid expression");
    }

    if (!Number.isFinite(value)) {
        throw new Error("Invalid result");
    }

    return value;
}

function cleanNumber(number) {
    if (!Number.isFinite(number)) {
        throw new Error("Result is out of range");
    }

    // Remove normal floating-point artifacts.
    const rounded = Number(number.toPrecision(12));

    if (Object.is(rounded, -0)) {
        return 0;
    }

    return rounded;
}

function formatNumber(number) {
    const cleaned = cleanNumber(number);

    // Use scientific notation for exceptionally large or small values.
    if (
        cleaned !== 0 &&
        (Math.abs(cleaned) >= 1e12 || Math.abs(cleaned) < 1e-7)
    ) {
        return cleaned.toExponential(6).replace(/\.?0+e/, "e");
    }

    return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: 10,
        useGrouping: true
    }).format(cleaned);
}

function updateDisplay() {
    expressionDisplay.textContent = expression
        ? prettyExpression(expression)
        : "0";

    expressionDisplay.scrollLeft = expressionDisplay.scrollWidth;

    resultDisplay.classList.remove("is-error");

    if (errorMessage) {
        resultDisplay.textContent = errorMessage;
        resultDisplay.classList.add("is-error");
        setMessage("Check your calculation");
        return;
    }

    if (!expression) {
        resultDisplay.textContent = "0";
        setMessage("Ready to calculate");
        lastValidPreview = null;
        return;
    }

    try {
        const value = evaluateExpression(expression);
        const formatted = formatNumber(value);

        resultDisplay.textContent = formatted;
        resultDisplay.scrollLeft = resultDisplay.scrollWidth;
        setMessage(justCalculated ? "Calculation complete" : "Live preview");

        lastValidPreview = value;
    } catch (error) {
        // An incomplete expression is normal while typing.
        if (error.message === "Cannot divide by zero") {
            resultDisplay.textContent = "Cannot divide by zero";
            resultDisplay.classList.add("is-error");
            setMessage("Division by zero is undefined");
        } else {
            resultDisplay.textContent = "…";
            setMessage("Enter the next value");
        }

        lastValidPreview = null;
    }
}

function showError(message) {
    errorMessage = message;
    resultDisplay.textContent = message;
    resultDisplay.classList.add("is-error");
    setMessage("Calculation error");
}

function clearCalculator() {
    expression = "";
    justCalculated = false;
    errorMessage = "";
    lastValidPreview = null;
    updateDisplay();
}

function appendDigit(digit) {
    if (errorMessage) {
        clearCalculator();
    }

    if (justCalculated) {
        expression = "";
        justCalculated = false;
    }

    if (expression.length >= MAX_EXPRESSION_LENGTH) return;

    const currentNumber = expression.match(/(?:\d+\.?\d*|\.\d+)$/)?.[0] || "";

    if (digit === ".") {
        if (currentNumber.includes(".")) return;

        if (!currentNumber) {
            expression += "0";
        }
    }

    // Replace a leading zero in the current number.
    if (/^\d+$/.test(digit) && currentNumber === "0") {
        expression = expression.slice(0, -1);
    }

    expression += digit;
    updateDisplay();
}

function appendOperator(operator) {
    if (errorMessage) {
        clearCalculator();
    }

    if (!expression) {
        if (operator === "-") {
            expression = "-";
            updateDisplay();
        }
        return;
    }

    if (justCalculated) {
        justCalculated = false;
    }

    const last = expression.slice(-1);

    if (isOperator(last)) {
        // Permit a unary minus after multiplication or division.
        if (
            operator === "-" &&
            (last === "*" || last === "/")
        ) {
            expression += operator;
        } else {
            expression = expression.slice(0, -1) + operator;
        }
    } else if (last === ".") {
        expression += "0" + operator;
    } else {
        expression += operator;
    }

    updateDisplay();
}

function deleteLast() {
    if (errorMessage) {
        clearCalculator();
        return;
    }

    if (justCalculated) {
        justCalculated = false;
    }

    expression = expression.slice(0, -1);
    updateDisplay();
}

function toggleSign() {
    if (errorMessage) {
        clearCalculator();
    }

    if (justCalculated) {
        justCalculated = false;
    }

    if (!expression) {
        expression = "-";
        updateDisplay();
        return;
    }

    // Locate the final number, including an optional decimal point.
    const match = expression.match(/(\d*\.?\d+)$/);

    if (match) {
        const start = match.index;
        const before = expression.slice(0, start);
        const number = match[0];

        if (before.endsWith("-") &&
            (before.length === 1 || isOperator(before.at(-2)))) {
            expression = before.slice(0, -1) + number;
        } else {
            expression = before + "(-" + number + ")";
        }
    } else if (isOperator(expression.at(-1))) {
        if (expression.at(-1) === "-") {
            expression = expression.slice(0, -1);
        } else {
            expression += "-";
        }
    } else {
        expression = "-(" + expression + ")";
    }

    updateDisplay();
}

function applyPercentage() {
    if (!expression || errorMessage) return;

    try {
        // Percentage applies to the final number:
        // 200 + 10% becomes 200 + 0.1.
        const match = expression.match(/(\d*\.?\d+)$/);

        if (!match) {
            const value = evaluateExpression(expression) / 100;
            expression = String(cleanNumber(value));
        } else {
            const start = match.index;
            const number = Number(match[0]) / 100;

            expression =
                expression.slice(0, start) + String(cleanNumber(number));
        }

        justCalculated = false;
        updateDisplay();
    } catch {
        showError("Invalid percentage");
    }
}

function calculate() {
    if (!expression || errorMessage) return;

    try {
        const value = evaluateExpression(expression);
        const cleaned = cleanNumber(value);

        expression = String(cleaned);
        justCalculated = true;
        errorMessage = "";
        updateDisplay();
        setMessage("Calculation complete");
    } catch (error) {
        showError(
            error.message === "Cannot divide by zero"
                ? "Cannot divide by zero"
                : "Invalid expression"
        );
    }
}

keypad.addEventListener("click", (event) => {
    const button = event.target.closest("button");

    if (!button) return;

    if (button.dataset.value !== undefined) {
        const value = button.dataset.value;

        if (isOperator(value)) {
            appendOperator(value);
        } else {
            appendDigit(value);
        }

        return;
    }
    switch (button.dataset.action) {
        case "clear":
            clearCalculator();
            break;

        case "delete":
            deleteLast();
            break;

        case "percent":
            applyPercentage();
            break;

        case "sign":
            toggleSign();
            break;

        case "equals":
            calculate();
            break;
    }
});

document.addEventListener("keydown", (event) => {
    const key = event.key;

    if (/^\d$/.test(key)) {
        appendDigit(key);
    } else if (key === ".") {
        appendDigit(".");
    } else if (OPERATORS.includes(key)) {
        appendOperator(key);
    } else if (key === "Enter" || key === "=") {
        event.preventDefault();
        calculate();
    } else if (key === "Backspace") {
        event.preventDefault();
        deleteLast();
    } else if (key === "Escape" || key === "Delete") {
        clearCalculator();
    } else if (key === "%") {
        applyPercentage();
    }
});

/* =========================================
   8. LIGHTWEIGHT PARTICLE GENERATION
========================================= */

function createParticles() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    const mobile = window.matchMedia("(max-width: 600px)").matches;
    const count = mobile ? 12 : 26;
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        const particle = document.createElement("span");

        particle.className = "particle";
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.width = `${2 + Math.random() * 3}px`;
        particle.style.height = particle.style.width;
        particle.style.setProperty(
            "--duration",
            `${8 + Math.random() * 12}s`
        );
        particle.style.setProperty(
            "--delay",
            `${-Math.random() * 12}s`
        );
        particle.style.setProperty(
            "--drift",
            `${Math.round(Math.random() * 70 - 35)}px`
        );

        fragment.appendChild(particle);
    }

    particlesContainer.replaceChildren(fragment);
}

createParticles();


const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
);

const desktopPointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
);

let pointerX = 0;
let pointerY = 0;
let frameRequested = false;

function handlePointerMove(event) {
    if (reducedMotion.matches || !desktopPointer.matches) return;

    pointerX = (event.clientX / window.innerWidth - 0.5) * 12;
    pointerY = (event.clientY / window.innerHeight - 0.5) * 12;

    if (frameRequested) return;

    frameRequested = true;

    requestAnimationFrame(() => {
        document.querySelector(".orb-one").style.translate =
            `${pointerX}px ${pointerY}px`;

        document.querySelector(".orb-two").style.translate =
            `${-pointerX}px ${-pointerY}px`;

        document.querySelector(".geometry-one").style.translate =
            `${pointerX * 0.6}px ${pointerY * 0.6}px`;

        frameRequested = false;
    });
}

document.addEventListener("pointermove", handlePointerMove, {
    passive: true
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        document.querySelectorAll(".particle").forEach((particle) => {
            particle.style.animationPlayState = "paused";
        });
    } else {
        document.querySelectorAll(".particle").forEach((particle) => {
            particle.style.animationPlayState = "running";
        });
    }
});

updateDisplay();
