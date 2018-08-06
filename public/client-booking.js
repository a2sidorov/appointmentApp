/* Client booking */
const appointment = {
  date: undefined,
  dateCheck: false,
  timeCheck: false,
  setMonth: function(dateISO, month) {
    if (this.date === undefined) {
      this.date = new Date(dateISO);
    }
    let list, div, txt, responseObj;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul','Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let days = document.getElementById('days');
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        responseObj = JSON.parse(this.responseText);
        //console.log('responseObj.DateObj ' + responseObj.DateObj);
        appointment.date = new Date(responseObj.dateISO);
        //console.log('DateObj ' + DateObj);
        document.getElementById('month').innerHTML = monthNames[appointment.date.getMonth()];
        removeChildren(days);
        responseObj.days.forEach((day) => {
          txt = document.createTextNode(day.num);
          div = document.createElement('DIV');
          list = document.createElement('LI');
          div.appendChild(txt);
          if (day.isAvailable) {
            div.classList.add('availableDays');
            div.onclick = function() {appointment.setDay(responseObj.dateISO, this)};
          }
          list.appendChild(div);
          days.appendChild(list);
        });
      }
    };
    xhttp.open('POST', `${window.location}/month`, true);
    xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhttp.send(`dateISO=${this.date.toISOString()}&month=${month}`);
  },
  setDay: function(dateISO, el) {
     if (this.date === undefined) {
      this.date = new Date(dateISO);
    }
    let dayNum, txt, p, list, responseObj;
    let timetable = document.getElementById('timetable');
    let checkedDay = document.getElementById('checkedDay');
    if (checkedDay && checkedDay !== el) {
      checkedDay.removeAttribute('id'); 
    }
    el.id = 'checkedDay';
    this.checkedDay = true;
    dayNum = el.innerHTML;
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        responseObj = JSON.parse(this.responseText);
        appointment.date = new Date(responseObj.dateISO);
        removeChildren(timetable);
        responseObj.hours.forEach((hour) => {
          list = document.createElement('LI');
          txt = document.createTextNode(hour.time);
          if (!hour.isBooked) {
            list.classList.add('availableTime');
            list.onclick = function() {appointment.setTime(this)};
          }
          list.appendChild(txt);
          timetable.appendChild(list);
        });     
      }
    };
    xhttp.open("POST", `${window.location}/day`, true);
    xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhttp.send(`dateISO=${appointment.date.toISOString()}&day=${dayNum}`);
  },
  setTime: function(el) {
    console.log(el);
    let checkedTime = document.getElementById('checkedTime');
    let hh, mm;
    if (checkedTime && checkedTime !== el) {
      checkedTime.removeAttribute('id'); 
    }
    el.id = 'checkedTime';
    this.checkedTime = true;
    hh = (el.innerHTML).substring(0, 2);
    mm = (el.innerHTML).substring(3);
    appointment.date.setHours(parseInt(hh));
    appointment.date.setMinutes(parseInt(mm));
    console.log(this.date);
  },
  book: function() {
    console.log(this.date);
    let div, txt;
    let main = document.getElementById('main');
    let msg = document.getElementById('msg');
    if (this.checkedDay && this.checkedTime) {
      let reason = document.getElementById('reason').innerHTML;
      const xhttp = new XMLHttpRequest();
      xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          console.log(this.responseText);
          msg = document.createTextNode(this.responseText);
          div = document.createElement('div');
          div.appendChild(msg);
          removeChildren(main);
          main.appendChild(div);
        }
      }
      xhttp.open("POST", `${window.location}/book`, true);
      xhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
      xhttp.send(`date=${appointment.date.toISOString()}&reason=${reason}`);
    } else {
      msg.innerHTML = 'You have to choose date and time.';
    }
  },
};



