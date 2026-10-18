<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>Flip Countdown</title>
    <link rel="shortcut icon" type="image/jpg" href="NY.png" />
    <style>
        @import url("https://fonts.googleapis.com/css?family=Poppins&display=swap");
        * {
            margin: 0;
            padding: 0;
            font-family: "Poppins", sans-serif;
        }
        @media screen and (min-width: 1025px) {
            body {
                background-attachment: fixed;
                background-blend-mode: hard-light;
            }
            .cdcontainer {
                width: 80%;
                margin: 10% ;
                /* padding: 11% 5%; */
                background-attachment: fixed;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                margin-bottom: 0px;
            }
            .cdcontainer title2 {
                text-align: center;
                font-size: 10em;
                line-height: 0.7em;
                color: #333;
                margin-top: -80px;
            }
            .cdcontainer title2 span {
                display: block;
                font-weight: 400;
                letter-spacing: 6px;
                font-size: 0.2em;
            }
            .countdown {
                display: flex;
                margin-top: 50px;
            }
            .countdown div {
                position: relative;
                width: 100px;
                height: 100px;
                line-height: 100px;
                text-align: center;
                background: #333333;
                color: #ffffff;
                margin: 0 15px;
                font-size: 3em;
                font-weight: 500;
            }
            .countdown div:before {
                content: "";
                position: absolute;
                bottom: -30px;
                left: 0;
                width: 100%;
                height: 35px;
                background: #ff0;
                color: #333;
                font-size: 0.35em;
                line-height: 35px;
                font-weight: 300;
            }
            .countdown #day:before {
                content: "Days";
            }
            .countdown #hour:before {
                content: "Hours";
            }
            .countdown #minute:before {
                content: "Minutes";
            }
            .countdown #second:before {
                content: "Seconds";
            }
        }
        @media screen and (max-width: 1024px) {
            html {
                background: rgb(0, 21, 32);
            }
            .cdcontainer {
                width: 100%;
                margin: 20% 0;
                padding: 0;
                background: rgb(0, 21, 32);
            }
            .cdcontainer title2 span {
                color: #fff;
                text-align: center;
                font-size: 1em;
            }
            .cdcontainer title2:first-child div {
                font-size: 6em;
                text-align: center;
                margin: 10% 0;
            }
            .countdown {
                display: flex;
                justify-content: space-around;
                margin: 0;
            }
            .countdown div {
                width: 20%;
                height: 13vw;
                margin: 0 10px;
                line-height: 13vw;
                font-size: 2.3em;
                text-align: center;
                background: #333333;
                color: #ffffff;
                font-weight: 500;
            }
            .countdown div:before {
                content: '';
                position: absolute;
                bottom: -30px;
                left: 0;
                width: 100%;
                height: 30px;
                background: #aaa;
                color: #333;
                font-size: .35em;
                line-height: 35px;
                font-weight: 300;
            }
            .countdown #day:before {
                content: 'Days';
            }
            .countdown #hour:before {
                content: 'Hours';
            }
            .countdown #minute:before {
                content: 'Minutes';
            }
            .countdown #second:before {
                content: 'Seconds';
            }
        }
    </style>
</head>

<div class="cdcontainer">
    <title2>
        <span>Countdown to NYUSH DIC 2024 Kick-off</span>
        <span id="date">Can't see mee (>﹏<)</span>
        <!-- <div id="Year">NA</div> -->
    </title2>
    <div class="countdown">
        <div id="day">NA</div>
        <div id="hour">NA</div>
        <div id="minute">NA</div>
        <div id="second">NA</div>
    </div>
</div>
<script>
    function newYear() {
        var Y = new Date().getFullYear();
        var newDay = '2024/11/24 17:30:00';
        var countDate = new Date(newDay);
        var now = new Date().getTime();
        var gap = countDate - now;
        if (gap < 0) {
            document.getElementById('day').innerText = '00';
            document.getElementById('hour').innerText = '00';
            document.getElementById('minute').innerText = '00';
            document.getElementById('second').innerText = '00';
            return;
        }
        var second = 1000;
        var minute = second * 60;
        var hour = minute * 60;
        var day = hour * 24;
        var d = Math.floor(gap / day);
        var h = Math.floor((gap % day) / hour);
        var m = Math.floor((gap % hour) / minute);
        var s = Math.floor((gap % minute) / second);
        d = addZero(d);
        h = addZero(h);
        m = addZero(m);
        s = addZero(s);
        document.getElementById('date').innerText = newDay;
        // document.getElementById('Year').innerText = Y;
        document.getElementById('day').innerText = d;
        document.getElementById('hour').innerText = h;
        document.getElementById('minute').innerText = m;
        document.getElementById('second').innerText = s;
    }
    function addZero(num) {
        return num < 10 ? '0' + num : num;
    }
    setInterval(newYear, 1000);
</script>