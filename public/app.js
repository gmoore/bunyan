var data = [];
var metrics;

var WINDOW_SIZE = 60;
var WINDOW_OFFSET = 10;

var colors = ["#CAE583",
              "#5E3EA0",
              "#C53918",
              "#203A23",
              "#4AA4B6",
              "#751F3F",
              "#F2B5E9",
              "#7DE115",
              "#F47860",
              "#1EB42C"]

Date.timestamp = function() { return Math.round(Date.now()/1000); };

$(function() {
  updateValues();
});

function streamLogs(app, elem) {
  var source = new EventSource('/app/' + app + "/logs");
  var update = setInterval(function() { updateValues(); }, 1000);

  source.addEventListener('message', function(e) {
    var line = $.parseJSON(e.data);
    var index = _.sortedIndex(data, line, 'timestamp');
    data.splice(index, 0, line);
  }, false);

  source.addEventListener('open', function(e) {}, false); // Opened connection
  source.addEventListener('error', function(e) {
    if (e.eventPhase == EventSource.CLOSED) {
      console.log("closed connection");
      console.log(e);
    }
  }, false);
}

function updateValues() {
  var window_start = _.sortedIndex(data, {timestamp: Date.timestamp() - (WINDOW_SIZE + WINDOW_OFFSET)}, 'timestamp')
  if (window_start > 0) {
    data.splice(0, window_start);
  }
  var window_end = _.sortedIndex(data, {timestamp: Date.timestamp() - (WINDOW_OFFSET)}, 'timestamp')
  var data_window = data.slice(0, window_end)

  metrics = new Object();

  // Aggregate metrics
  $.each(data_window, function(k, item) {
    $.each(item, function(k,v) {
      metrics[k] === undefined ? metrics[k] = [] : null;
      metrics[k].push(v);
    });
  });

  $(".metric").each(function() {
    var type = $(this).data("type");
    var display = $(this).data("display");

    if (metrics[type] === undefined) {
      $(this).addClass("loading")
      showDefault(this);
    } else {
      $(this).removeClass("loading")
      window[display](metrics[type], this);
    }
  });

  $(".dyno").each(function() {
    var type = $(this).data("type");
    var display = $(this).data("display");
    window[display](metrics[type], this);
  });
}

///////////////////////////////////////////
// Measurements
///////////////////////////////////////////

function actual(items, elem) {
  if (items != undefined) {
    item = items[items.length - 1]
    //This is updating this div once for each item in items. Dumb
    setText($("#memory_"+item[0]),item[1])
  }
  
}

function actual_with_limit(items, elem) {
  if (items != undefined) {
    item = items[items.length - 1]

    limit = item[2]
    el = $("#memory_"+item[0])

    //This is updating this div once for each item in items. Dumb
    setText(el,item[1])
    if (item[1] > limit) {
      $(".data", el).addClass("danger")
    }
  }
  
}

function bar(items, elem) {
  setBar(elem, items)
}

function sum(items, elem) {
  var value = items.length;
  setText(elem, value);
}

function average(items, elem) {
  var value;
  var sum = 0;
  var units = $(elem).data("units") === undefined ? 1 : $(elem).data("units")

  $.each(items, function() { sum += this });
  value = Math.round(sum/Math.max(items.length,1)/units);
  setText(elem, value);
}

function counter(items, elem) {
  var container = $(".data", elem)
  var values = {}
  if ($(elem).data("default")) {
    $.each($(elem).data("default"), function() { values[this] = 0 })
  }

  $.each(items, function() {
    values[this] === undefined ? values[this] = 0 : null;
    values[this] += 1
  });

  container.empty()
  $.each(Object.keys(values).sort(), function(k,v) {
    container.append($("<li>" + v + ": " + values[v] + "</li>"))
  })
}

function activity(items, elem) {
  var sum = 0;
  var activity;
  $.each(items, function() { sum += this });

  value = ((sum/(WINDOW_SIZE * 300 * $(elem).data("procs"))) * 100).toFixed(2)
  $(".data", elem).css("width", value + "%")
  setText(elem, "")
}

function median(items, elem) {
  setText(elem, percentile_index(items, 50));
}

function perc95(items, elem) {
  setText(elem, percentile_index(items, 95));
}

function max(items, elem) {
  setText(elem, percentile_index(items, 100));
}

function percentile_index(items, percentile) {
  percentile = percentile/100
  items.sort(function(a,b) { return a - b })
  return items[Math.ceil((Math.max(items.length - 1,0)) * percentile)]
}

///////////////////////////////////////////
// Helpers
///////////////////////////////////////////

function showDefault(elem) {
  $(".data", elem).empty().text("--")
}

function setBar(elem, value) {

  //each dyno gets their own progressBars[dyno_num]
  //progressBars is an array of html strings
  var progressBars = new Array()

  //build brogress bars
  progessBarHtml = "<div class='progress' id='progress-bar'>"
  for (var i = 0, len = value.length; i < len; ++i) {
    dyno = value [i][0]
    path = value [i][1]
    service = value[i][2]
    if (progressBars[dyno] == undefined) {
      progressBars[dyno] = ""
    }
    tooltipText = path + " " + service + "ms"
    progressBars[dyno] += "<div class='progress-bar' style='background-color:"+colors[service%10]+";width:"+(service * (1140/30000.0))+"px' data-request='"+tooltipText+"'></div>"
  } 
  progessBarHtml += "</div>" 

  //set the progress bars
  $.each($(".progress"), function(index) {
    $(this).empty()
    if (progressBars[index+1] != undefined) { 
      $(this).html(progressBars[index+1])
    }
  });

  $.each($(".progress-bar"), function(index) {
		$(this).click(function () {
			$('#request-display').text($(this).attr('data-request'))
		})
	})
}

function setText(elem, value) {
  $(".data", elem).text(value + $(elem).data("label"))
}
