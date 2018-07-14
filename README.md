# datatables-server-side-node
The node implementation of server side processing in node, works with sequelize.

# installation

npm i datatables-server-side-node@latest --save

# Usage

const SSP = require('datatables-server-side-node')();
...
...
#some where in your code
...
...
  var table = this.tableName;
  var primaryKey = 'id';
  var columns = [];
  columns.push({"db":"name",'dt':0});
  ...
  var ssp_obj = new SSP(sequelize_object);
  ssp_obj.simple(request.query, table, primaryKey, columns,function(err, response) {
    ...your code....
  });
  
  
