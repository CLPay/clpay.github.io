// on load
window.onload = function () {
    try {
        // load data from url
        let data = loadData();
        // check user location ip to see if they are allowed to use the gateway
        checkLocation();
        // show price
        loadPrice(data.fiat);
        // upon payment button click get new rate and calculate fee
        openPayment(data);
    } catch (error) {
        console.log(error);
        loadError("data");
    }
}


function loadData() {
    let params = new URLSearchParams(window.location.search);
    if (params.has("data"))
        return JSON.parse(atob(new URLSearchParams(window.location.search).get("data")));
    else
        throw new Error("No data found in url");
}

// check user location
function checkLocation(allowed = ["IR", "TR"]) {
    // check user location with 3rd party api
    try {
        let field = "countryCode";
        fetchJson('https://freeipapi.com/api/json').then((response) => {
            if (!(field in response) || response[field] === "" || response[field] === null)
                throw new Error("No country code found");
            allowed.indexOf(response[field]) === -1 ? loadError("location") : showPayment();
        }).catch((error) => {
            console.log(error);
            showPayment();
        });
    } catch (error) {
        console.log(error);
        showPayment();
    }
}

async function fetchJson(url) {
    return fetch(url).then(res => res.clone().json());
}

function getGatewayData(gateway) {
    switch (gateway) {
        case 1:
            return {
                id: gateway,
                url: "https://weswap.digital/quick",
                rate: "https://api.weswap.digital/api/rate",
                fee: (amount) => amount > 250000 ? amount * 0.06 : 15000
            };
        case 2:
            return {
                id: gateway,
                url: "https://digiswap.org/quick",
                rate: "https://api.digiswap.org/api/v1/asset/getPrices",
                fee: (amount) => 15000
            }
        default:
            throw new Error("Invalid gateway");
    }

}

function getPaymentUrl(e, gateway, fiat, code, address, open = true) {
    getRate(e.target, gateway).then((rate) => {
        let fee = calcFee(fiat, gateway);
        let amount = (fiat - fee) / rate;
        amount = amount.toFixed(3) + code;
        let link = gateway.url + "?amount=" + amount + "&currency=" + 'TRX' + "&address=" + address;
        if (open)
            window.open(link, '_self');
        console.log(link);
        return link;
    }).catch((error) => {
        console.log(error);
    });
}

async function getRate(button, gateway) {
    // disable button
    button.classList.add('disabled');
    button.setAttribute('role', 'disabled')
    // fetch rate from gateway api
    const request = new Request(gateway.rate);
    return fetchJson(request).then((response) => {
        switch (gateway.id) {
            case 1: // weswap
                // check if response is status 200
                if (response.status !== 200 && response.success !== true)
                    throw new Error("failed fetching rate");
                return response.result.TRX;
            case 2: // digiswap
                // check response keys
                if (!("usd_sell_price" in response) || !("assets" in response))
                    throw new Error("failed fetching rate");
                return response.usd_sell_price * response.assets[1].usd_price;
        }
    }).catch((error) => {
        throw error;
    }).finally(() => {
        // enable button
        button.classList.remove('disabled');
        button.setAttribute('role', 'button')
    });
}

function calcFee(amount, gateway) {
    let fee = 0;
    let total = amount;
    for (let i = 0; i <= 3; i++) {
        fee = gateway.fee(total);
        total = amount - fee;
    }
    return (fee.toFixed(0) / 10).toFixed(0) * 10;
}

function loadError(type = "data") {
    if (type === "location") {
        // lazy load qrcode image from google api
        let qrcode = document.getElementById("qrcode");
        qrcode.src = "https://chart.googleapis.com/chart?chd=L&chs=300x300&choe=UTF-8&cht=qr&chl=" + window.location.href;
        qrcode.addEventListener("load", () => {
            showError(type)
        });
        document.getElementById("qrcode").addEventListener("click", () => {
            window.location.reload();
        });
    } else {
        showError(type)
    }
}

function showError(type) {
    document.getElementById("loading").classList.add('hidden');
    document.getElementById(type).classList.remove('hidden');
}

function showPayment() {
    document.getElementById("loading").classList.add('hidden');
    document.getElementById("payment").classList.remove('hidden');
}

function toFarsiNumber(n) {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return n
        .toString()
        .replace(/\d/g, x => farsiDigits[x]);
}

function loadPrice(fiat) {
    document.getElementById("fiat").innerHTML = toFarsiNumber(fiat.toLocaleString());
}

function openPayment(data) {
    document.getElementById("link").addEventListener("click", (e) => {
        let gateway = getGatewayData(data.gateway);
        getPaymentUrl(e, gateway, data.fiat, data.code, data.address, true);
    });
}
