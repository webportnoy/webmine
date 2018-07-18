/*
	Работа с массивом объектов в стиле SQL

	// Создание объекта
	var db = new database();

	// Добавление данных массивом
	db.insert([
		{id: 1, name: "Nick"},
		{id: 2, name: "Poul"},
		{id: 3, name: "Aaron"},
		{id: 4, name: "Nick"},
		{id: 5, name: "Buzz"}]
		);

	// Добавление данных построчно
	db.insert({id: 6, name: "Santa"});

	// Запрос вернет массив из объектов соответсвующих условиям
	db.select('id, test, name').where("`name`!='Nick'").query();

	// Пример с группировкой
	db.select('id, count(*), name').groupby('name').query();

	// Пример с сортировкой и группировкой
	db.select('id, count(*), name').groupby('name').orderby('count(*) desc').query();

	// Аналог предыдущего примера одним вызовом
	db.query({select: 'id, count(*), name', groupby: 'name', orderby: 'count(*) desc'});

	// Получить только первую строку
	db.limit('1').query();

	// Получить две строки начиная с 3-й
	db.limit('3, 2').query();

	// Удалить все данные
	db.truncate();

	// Вернуть количество найденных запросом строк
	db.num_rows();

	// Вернуть количество колонок в результате запроса
	db.num_cols();

	// Вернуть названия колонок
	db.show_columns();

	TODO:
	update method
	delete method

*/
function database( init_data ){

	/* Private */

	var self = this,
		data = [],
		temp_data = null,
		grouping = null,
		num_rows = 0,
		num_cols = 0,
		columns = [],
		query_params = {},
		query_params_defaults = {
			select: "*",
			where: "1",
			groupby: "",
			orderby: "",
			limit: {offset: 0, max: -1}
		};

	function is_array( mixed_var ) {
		return ( mixed_var instanceof Array );
	}

	function is_object( value ){
		return (typeof value == "object");
	}

	function is_string( value ){
		return (typeof value == "string");
	}

	function is_number( value ){
		return (typeof value == "number");
	}

	function object_keys( obj ){
		var keys = [],
			key;
		for( key in obj ){
			keys.push( key );
		}
		return keys;
	}

	// Рекурсивное слияние обектов
	function object_merge( obj1, obj2 ){
		if( typeof obj2 == "undefined" ) return obj1;
		if( typeof obj1 == "undefined" ) return {};
		var result = {},
			key;
		for( key in obj1) {
			if( typeof obj2[key] == "undefined" ){
				result[key] = obj1[key];
			}
			else if( typeof obj2[key] == "object" && (!obj2[key] instanceof Array) && typeof obj1[key] != "undefined" ){
				result[key] = object_merge(obj1[key], obj2[key]);
			}
			else{
				result[key] = obj2[key];
			}
		}
		for( key in obj2){
			if( typeof result[key] == "undefined" ){
				result[key] = obj2[key];
			}
		}
		return result;
	}

	// Получение сгруппированных данных
	function getGroupedData(){
		temp_data = data;
		grouping = {data:[],counts:{}};
		var col = query_params.groupby.trim(),
			row_num = 0;
		for( row_num in data ){

			if( !(data[row_num][col] in grouping.counts) ){
				grouping.counts[data[row_num][col]] = 1;
				grouping.data.push( data[row_num] );				
			}
			else{
				grouping.counts[data[row_num][col]]++;
			}
		}
		data = grouping.data;
	}

	// Сортировка по одному условию
	function sortDataCond( arr, cond ){
		var dir = ('order' in cond && cond.order.toLowerCase() == "desc") ? -1 : 1;
		arr.sort( function( a, b ){
			if( !(cond.col in a) || !(cond.col in b) ){
				return 0;
			}
			if( a[cond.col] < b[cond.col] ){
				return -1 * dir;
			}
			if( a[cond.col] > b[cond.col] ){
				return 1 * dir;
			}
			return 0;
		});
		return arr;
	}

	// Выбор сортировок
	function sortData( arr ){
		if( !query_params.orderby || is_string( query_params.orderby ) ){
			return arr;
		}
		if( is_array( query_params.orderby ) ){
			for( var i = query_params.orderby.length-1; i>=0; i-- ){
				arr = sortDataCond( arr, query_params.orderby[i] );
			}
		}
		else if( is_object( query_params.orderby ) ){
			arr = sortDataCond( arr, query_params.orderby );
		}
		return arr;
	}

	// Получение строки в выборке
	function select_columns( row ){
		var new_row = {};
		if( query_params.select == "*" ){
			return row;
		}
		else if( typeof query_params.select == "string" ){
			query_params.select = query_params.select.split(",");
		}

		if( is_array( query_params.select ) ){
			for( var i in query_params.select ){
				var col = query_params.select[i].trim().replace(/`/g,'');
				if( ( col == "count(*)" || col == "count()" ) && query_params.groupby ){
					new_row[col] = grouping.counts[row[query_params.groupby]];
				}
				else if( col == "*" ){
					new_row = object_merge( row, new_row );
				}
				else{
					new_row[col] = row[col] || "";
				}
			}
		}
		return new_row;
	}

	// Проверка соответствия условию .where()
	function where_check( row ){
		if( !query_params.where || query_params.where.trim() == "1" ){
			return true;
		}
		var cond = query_params.where,
			vars = cond.match(/`[a-zA-Z0-9_\(\)\*]+`/g),
			value = null,
			res = false;
		for( var i in vars ){
			value = row[vars[i].replace(/`/g, "")] || '';
			if( is_string( value ) ){
				value = "'" + value + "'";
			}
			cond = cond.replace( vars[i], value );
		}
		try{
			res = eval( cond );
		} catch(e) {
			res = false;
			console.log( e.name + " - " + e.message );
		}
		return res;
	}

	// Парсинг параметров для запроса через .query()
	function parseParams( params ){
		query_params = object_merge( query_params_defaults, query_params );
		if( params ){
			if( 'select' in params ){
				self.select(params.select);
			}
			if( 'where' in params ){
				self.where(params.where);
			}
			if( 'groupby' in params ){
				self.groupby(params.groupby);
			}
			if( 'orderby' in params ){
				self.orderby(params.orderby);
			}
			if( 'limit' in params ){
				self.limit(params.limit);
			}
		}
	}

	/* Public methods */

	// Внести данные в базу массивом или построчно
	this.insert = function( val ){
		data = data.concat( val );
		return this;
	};

	// Вурнуть сырые данные
	this.getData = function(){
		return data;
	};

	// Делаем запрос
	this.query = function( params ){
		parseParams( params );
		//console.log( query_params );

		if( query_params.groupby ){
			getGroupedData();
		}
		var ret = [],
			offset = 0;
		num_rows = 0;
		for( var row in data ){
			if( where_check( data[row] ) ){
				if( offset < query_params.limit.offset ){
					offset++;
					continue;
				}
				ret.push( select_columns( data[row] ) );
				num_rows++;
				if( query_params.limit.max != -1 && num_rows >= query_params.limit.max ){
					break;
				}
			}
		}
		if( num_rows ){
			columns = object_keys( ret[0] );
			num_cols = columns.length;
		}
		if( query_params.orderby ){
			ret = sortData( ret );
		}
		this.reset();
		return ret;
	};

	// Сброс
	this.reset = function(){
		query_params = query_params_defaults;
		if( temp_data ){
			data = temp_data;
			temp_data = null;
		}
		return this;
	};

	// Удаление всех данных
	this.truncate = function(){
		query_params = query_params_defaults;
		data = [];
		temp_data = null;
		return this;
	};

	// Задаем фильтр (аналог where в SQL)
	this.where = function( cond ){
		if( !cond || (is_string( cond ) && cond.trim() == "1") ){
			query_params.where = "1";
		}
		else{
			query_params.where = cond;
		}
		return this;
	};

	// Задаем группировку
	this.groupby = function( col ){
		if( !col || !is_string( col ) ){
			query_params.groupby = query_params_defaults.groupby;
		}
		else if( is_string( col ) ){
			query_params.groupby = col.trim();
		}
		return this;
	};

	// Задаем порядок
	this.orderby = function( col ){
		if( !col || !is_string( col ) ){
			query_params.orderby = query_params_defaults.orderby;
		}
		else if( is_string( col ) ){
			if( col.indexOf(",") != -1 ){
				query_params.orderby = [];
				var cols = col.split(/\,/),
					i=0,
					c="";
				for( i in cols ){
					c = cols[i].trim().split(/\s+/);
					query_params.orderby.push({'col': c[0].trim(), 'order': (c[1] || "asc").trim() });
				}
			}
			else{
				col = col.trim().split(/\s+/);
				query_params.orderby = {'col': col[0].trim(), 'order': (col[1] || "asc").trim() };
			}
		}
		return this;
	};

	// Задаем лимит
	this.limit = function( lim ){
		if( is_number( lim ) ){
			query_params.limit = {offset: 0, max: lim};
		}
		else if( is_string( lim ) ){
			lim = lim.replace(/\s/g,"").split(/\,/).map(function(v){return parseInt(v, 10);});
			if( lim.length == 1 ){
				query_params.limit = {offset: 0, max: lim[0]};
			}
			else if( lim.length == 2 ){
				query_params.limit = {offset: lim[0], max: lim[1] };
			}
		}
		return this;
	};

	// Указать какие колонки надо выдать в результате запроса
	this.select = function( cols ){
		if( typeof cols == "string" && cols.trim() == "*" ){
			query_params.select = "*";
		}
		else if( typeof cols == "string" ){
			query_params.select = cols.split(",");
		}
		else if( is_array( cols ) ){
			query_params.select = cols;
		}
		return this;
	};

	// Количество найденных строк
	this.num_rows = function(){
		return num_rows;
	};

	// Количество колонок
	this.num_cols = function(){
		return num_cols;
	};

	// Количество колонок
	this.show_columns = function(){
		return columns;
	};

	// Внесение данных при создании объекта
	if( is_array( init_data ) ){
		this.insert( init_data );
	}

	return this;

}