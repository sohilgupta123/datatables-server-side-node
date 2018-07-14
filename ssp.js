module.exports = function() {

var SSP = function(connection) {
  this.connection = connection;
};

SSP.prototype.data_output = function(columns, data) {
  var out = [];
  for (var i = 0, ien = data.length; i < ien; i++) {
    var row = [];
    for (var j = 0, jen = columns.length; j < jen; j++) {
      var column = columns[j];
      if (typeof columns.formatter !== "undefined") {
        row[column['dt']] = column['formatter'](data[i][column['db']], data[i]);
      } else {
        row[column['dt']] = data[i][column['db']];
      }
    }
    out.push(row);
  }
  return out;
};

SSP.prototype.limit = function(request, columns) {
  var limit = '';
  if (typeof request.start !== "undefined" && request.length !== -1) {
    limit = "LIMIT " + parseInt(request['start'], 10) + ", " + parseInt(request['length'], 10);
  }
  return limit;
}

SSP.prototype.order = function(request, columns) {
  var order = '';
  if (typeof request.order !== "undefined" && request.order.length > 0) {
    var orderBy = [];
    var dtColumns = this.pluck(columns, 'dt');
    for (var i = 0, ien = request.order.length; i < ien; i++) {
      var columnIdx = parseInt(request['order'][i]['column'],10);
      var requestColumn = request.columns[columnIdx];
      columnIdx = dtColumns.indexOf(parseInt(requestColumn.data,10));
      var column = columns[columnIdx];
      if (requestColumn['orderable'] == 'true') {
        dir = request['order'][i]['dir'] === 'asc' ? 'ASC' : 'DESC';
        orderBy.push('`' + column['db'] + '` ' + dir);
      }
    }
    if (orderBy.length > 0) {
      order = 'ORDER BY ' + orderBy.join(', ');
    }
  }
  return order;
}

SSP.prototype.filter = function(request, columns, bindings)
{
  var globalSearch = [];
  var columnSearch = [];
  var dtColumns = this.pluck(columns, 'dt');
  if (typeof request.search !== "undefined" && request['search']['value'] !== '') {
    var str = request['search']['value'];
    for (var i = 0, ien = request.columns.length; i < ien; i++) {
      var requestColumn = request.columns[i];
      var columnIdx = dtColumns.indexOf(parseInt(requestColumn['data'],10));
      var column = columns[columnIdx];
      console.log(columns);
      console.log(columnIdx);
      console.log(requestColumn);
      if (requestColumn.searchable == 'true') {
        var binding = this.bind(bindings, '%' + str + '%', 'str');
        globalSearch.push("`" + column.db + "` LIKE " + binding);
      }
    }
  }
  // Individual column filtering
  if (typeof request.columns !== "undefined") {
    for (var i = 0, ien = request.columns.length; i < ien; i++) {
      var requestColumn = request['columns'][i];
      var columnIdx = dtColumns.indexOf(parseInt(requestColumn['data'],10));
      var column = columns[columnIdx];
      var str = requestColumn['search']['value'];
      if (requestColumn['searchable'] == 'true' && str != '') {
        var binding = this.bind(bindings, '%' + str + '%', 'str');
        columnSearch.push("`" + column['db'] + "` LIKE " + binding);
      }
    }
  }
// Combine the filters into a single string
  var where = '';
  if (globalSearch.length > 0) {
    where = '(' + globalSearch.join(' OR ') + ')';
  }
  if (columnSearch.length > 0) {
    where = where === '' ? columnSearch.join(' AND ') : where + ' AND ' + columnSearch.join(' AND ');
  }
  if (where !== '') {
    where = 'WHERE ' + where;
  }
  return where;
}

SSP.prototype.simple = function(request, table, primaryKey, columns,callback) {
  var bindings = [];
  var db = this.connection;
  // Build the SQL query string from the request
  var limit = this.limit(request, columns);
  var order = this.order(request, columns);
  var where = this.filter(request, columns, bindings);
  // Main query to actually get the data
  var _this = this;
  this.sql_exec(bindings, "SELECT `" + this.pluck(columns, 'db').join("`, `") + "` FROM `" + table + "` " + where + " " + order + " " + limit,function(err,row) {
    if(err) {
      callback(err);
    }
    else {
      var data = row;
      console.log(data);
      _this.sql_exec(bindings, "SELECT COUNT(`"+primaryKey+"`) as tableFiltered FROM   `"+table+"` "+where+"",function(err,resFilterLength) {
        if(err) {
          callback(err);
        }
        else {
          console.log(resFilterLength);
          var recordsFiltered = resFilterLength[0]['tableFiltered'];
          // Total data set length
          _this.sql_exec(bindings,"SELECT COUNT(`"+primaryKey+"`) as tableTotal FROM   `" + table + "`",function(err,resTotalLength) {
            if(err) {
              callback(err);
            }
            else {
              console.log(resTotalLength);
              var recordsTotal = resTotalLength[0]['tableTotal'];
              var outputData = _this.data_output(columns, data);
              var response = {
                "draw": typeof request.draw !== "undefined" ? parseInt(request.draw, 10) : 0,
                "recordsTotal": parseInt(recordsTotal, 10),
                "recordsFiltered": parseInt(recordsFiltered, 10),
                "data": outputData
              };
              callback(null,response);
            }
          });
        }
      });
    }
  });
}

SSP.prototype.sql_exec = function(bindings, sql = null,callback) {
  // Argument shifting
  if (sql === null) {
    sql = bindings;
  }

  if(typeof bindings == "object") {
    for (var i=0, ien=bindings.length ; i<ien ; i++ ) {
				var binding = bindings[i];
				sql = sql.replace(binding['key'], "'"+binding['val']+"'");
			}
  }
  this.connection.query(sql,{raw:true,logging: console.log,  plain: false,type: this.connection.QueryTypes.SELECT}).then((row) => {
    callback(null, JSON.parse(JSON.stringify(row)));
  }).catch((err)=> {
    callback(err);
  });
}

SSP.prototype.fatal = function(msg) {
  return JSON.stringify({
    "error": $msg
  });
}

SSP.prototype.bind = function(a, val, type) {
  var key = ':binding_' + a.length;
  a.push({
    'key': key,
    'val': val,
    'type': type
  });
  return key;
}

SSP.prototype.pluck = function(a, prop) {
  var out = [];
  for (var i = 0, len = a.length; i < len; i++) {
    out.push(a[i][prop]);
  }
  return out;
}
SSP.prototype._flatten = function(a, join = ' AND ') {
  if (!a) {
    return '';
  } else if (a && typeof a == "object") {
  return a.join(join);
}
return a;
}
return SSP;
};
