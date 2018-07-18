// Заполнение двумерной матрицы
function Matrix( x, y, DefVal) {
	var m = [];
	for(var i = 0; i < x; i++){
		m[i] = [];
		for( var j = 0; j < y; j++ ){
			m[i][j] = DefVal;
		}
	}
	return m;
}

var app = {
	oLayout: null,
	mode: 1,
	W: 9,
	H: 9,
	MineCount: 10,
	MinesLeft: 10,
	Cheats: 0,
	DoneCheat: false, 
	CheatX: 0, 
	CheatY: 0,
	CurTime: 0,
	GameTimer: null,
	GameRun: false,
	CanRun: true,
	Pause: false,
	field: [],
	modes: [{},
		{W: 9, H: 9, MineCount: 10, name: "Novice"},
		{W: 16, H: 16, MineCount: 40, name: "Medium"},
		{W: 30, H: 16, MineCount: 99, name: "Profi"}],

    userName: "Player",
    topNovice: "999",
	topMedium: "999",
	topProfi: "999",
	playerName: "Player",

	mobileTouch: !!('ontouchstart' in window) && screen.width < 980,

	settingsToSave: "W,H,MineCount,mode,userName,topNovice,topMedium,topProfi,playerName"

};

app.init = function() {
	app.menuInit();
	app.Settings();
	app.newGame();
	$("#dFace").click( app.newGame );
	app.loadHiscores();
};

app.Settings = function(){

	app.settingsToSave.split(",").forEach(function( val ){
		app[val] = localStorage[val] || app[val];
	});

	if( app.playerName == "Player" ){
		app.playerName += "-" + Math.round( 1000 + 9999*Math.random() );
	}

	$("#iCustomW").val( app.W );
	$("#iCustomH").val( app.H );
	$("#iCustomMines").val( app.MineCount );
	$("#settings input[type='radio']:eq(" + (app.mode-1) + ")").click();
	$("#hsNovice").text( app.topNovice );
	$("#hsMedium").text( app.topMedium );
	$("#hsProfi").text( app.topProfi );

	$("#iName").val( app.playerName ).change(function(){
		app.playerName = $(this).val();
		app.SettingSave();
	});

	if( app.mode == 4 ){
		$(".cusomSettings").show('fast');
	}

	$("#settings input[type='radio']").click(function(){
		app.mode = $(this).val();
		if( app.mode < 4 ){
			$(".cusomSettings").hide("fast");
			app.setMode( app.modes[app.mode].W, app.modes[app.mode].H, app.modes[app.mode].MineCount );
		}
		else{
			$(".cusomSettings").show('fast');
			$("#btnAply").click(function(){
				app.setMode( $("#iCustomW").val(), $("#iCustomH").val(), $("#iCustomMines").val() );
			});
		}
	});
};

app.setMode = function( w, h, mines ){
	app.W = parseInt( w, 10 );
	app.H = parseInt( h, 10 );
	app.MineCount = parseInt( mines, 10 );
	app.SettingSave();
	app.newGame();
};

app.loadHiscores = function(){
	$.getJSON("highscores.json?" + Math.round(9999*Math.random()), function( r ){
		if( r.length ){
			app.db = new database();
			app.db.insert( r );

			var html="",
				captions = [ lang.mode_easy, lang.mode_medium, lang.mode_hard ],
				top = {
					novice: app.db.query({where: '`novice` < 999', orderby: 'novice asc', limit: 5}),
					medium: app.db.query({where: '`medium` < 999', orderby: 'medium asc', limit: 5}),
					profi: app.db.query({where: '`profi` < 999', orderby: 'profi asc', limit: 5})
				};
			"novice,medium,profi".split(",").forEach(function( v, i ){
				html += '<div class="bdb"><div class="scores-line row ac">' + captions[i] + '</div>';
				top[v].forEach(function( l, k ){
					html += '<div class="scores-line row' + (l.name == app.playerName ? " green" : "") + '"><big>&#1012' + (k+2) + ";</big> <b>" + l.name + '</b> <span>' + l[v] + "</span></div>";
				});
				html +='</div>';
				$(".hiscores").html(html);
			});
		}
	});
};

app.saveHighscore = function( cb ){
	var d = {
		name: app.playerName,
		novice: app.topNovice,
		medium: app.topMedium,
		profi: app.topProfi
	};
	console.log(d);
	$.post("php/highscores.php", d, cb );
};


app.SettingSave = function(){
	app.settingsToSave.split(",").forEach(function( val ){
		localStorage[val] = app[val];
	});
};

app.newGame = function(){

	if( app.MineCount >= app.W * app.H ) {
		app.MineCount = Math.round( app.W * app.H / 7 );
		alert( lang.toomach.replace("%d", app.MineCount ) );
		$("#iCustomMines").val( app.MineCount );
		app.SettingSave();
	}

	clearInterval( app.GameTimer );
	app.setTime( 0 );
	app.setMinesLeft( app.MineCount );

	// Matr - Рабочее поле
    // 0-8  - цифры
    // 9    - мина
    app.Matr = Matrix(app.W, app.H, 0);
    
    // User - Пользовательское поле
    // 0 - закрыто
    // 1 - открыто
    // 2 - отмечено флажком
    app.User = Matrix(app.W, app.H, 0);

	app.clearField();
	app.CanRun = true;
	app.setFace( 1 );

};

app.prevent = function (e){
	e.preventDefault();
	if( app.mobileTouch ){
		var x = $(this).data("x"),
			y = $(this).data("y");
		if( app.User[x][y] === 0){
			app.setFlag( x, y );
		}
		else if( app.User[x][y] === 2 ){
			app.setBlank( x, y );
		}
	}
};

app.cellMouseDown = function( e ){
	if( !app.GameRun) {
		if(app.CanRun){
			app.GameRun = true;
			app.GameTimer = window.setInterval( app.onGameTimer, 1000 );
		}
		else return; 
	}

	app.setFace( 2 );
	var x = $(this).data("x"),
		y = $(this).data("y");

	e.preventDefault();
	// левая кнопка
	if( e.which == 1 ){
		app.cellClick( x, y );
	}
	// правая кнопка
	else if( e.which == 3 ){
		if( app.User[x][y] === 0){
			app.setFlag( x, y );
		}
		else if( app.User[x][y] === 2 ){
			app.setBlank( x, y );
		}
	}
	// Средняя или обе кнопки
	else if( e.which == 2 ){
		if( app.User[x][y] === 1 ){
			app.CheckCell( x, y );
		}
	}

};

app.cellClick = function( x, y ){
	if( app.Matr[x][y] == 9) { 
		app.boom(x, y);
		return;
	}
	if( app.Matr[x][y] === 0 ) {
		app.FillBlank(x,y);
		return;
	}
	else {
		app.User[x][y] = 1;
		app.setIcon( x, y, app.Matr[x][y] );
	}
};

app.cellMouseUp = function( e ){
	if( !app.GameRun ) return;
	app.setFace( 1 );
	if( !app.DoneCheat ) return;
	var x = app.CheatX, 
		y = app.CheatY;
	app.DoneCheat = false;
	app.forSiblingsCells( x, y, function( x1, y1 ){
		if( app.User[x1][y1] === 0 ){
			app.setIcon( x1, y1, "blank" );
		}
	} );
	app.setIcon( x, y, app.Matr[x][y] );
};

app.setBlank = function( x, y ){
	app.setMinesLeft( app.MinesLeft+1 );
	app.setIcon( x, y, "blank");
	app.User[x][y] = 0;
};

app.setFlag = function( x, y ){
	app.setMinesLeft( app.MinesLeft-1 );
	app.setIcon( x, y, "flag");
	app.User[x][y] = 2;
};

app.setIcon = function( x, y, icon ){
	$("#iCell_" + x + "_" + y).get(0).className = "field-cell ico-" + icon;
};

app.setFace = function( icon ){
	var fa = ['','fas fa-meh','fas fa-smile','fas fa-grin-stars','fas fa-frown'];
	$("#dFace").get(0).className = fa[icon];
};

app.onGameTimer = function(){

	var Opened = 0;  
	app.forAllCells(function( x, y ){
		if( app.User[x][y] == 1) Opened++;
	});

	if( Opened == (app.W * app.H) - app.MineCount ) {
		console.log("win", app.modes[app.mode].name, app.CurTime, app.modes[app.mode].name );

		clearInterval( app.GameTimer );
		app.setFace( 3 );

		var modeKey = app.modes[app.mode].name;
		if( app['top' + modeKey] > app.CurTime && !app.Cheats ){
			app['top' + modeKey] = app.CurTime;
			alert( lang.highscore[app.mode] + ": " + app.CurTime );
			$("#hs" + modeKey).text( app.CurTime );
			app.saveHighscore( function(){
				app.loadHiscores();
			});
		}

		app.GameRun = false;
		app.CanRun = false;
		app.SettingSave();
		return;
	}
	if( !app.Pause ){
		app.setTime( app.CurTime + 1 );
	}
};

app.boom = function( x, y ){
	app.setFace( 4 );
	app.GameRun = false;
	app.CanRun = false;
	clearInterval( app.GameTimer );

	app.forAllCells(function(x1, y1){
		if( app.User[x1][y1] != 2 && app.Matr[x1][y1] == 9){
			app.setIcon( x1, y1, ( x1==x && y1 == y ) ? "blowmine" : "coolmine");

		}   
		else if(app.User[x1][y1] == 2 && app.Matr[x1][y1] != 9){
			app.setIcon( x1, y1, "wrong");
			app.User[x1][y1] = 1;
		}
	});
};

// Откроем пустые ячейки до границы с цифрами
app.FillBlank = function( x, y ){
	app.User[x][y] = 1;
	app.setIcon( x, y, app.Matr[x][y] );
	if( app.Matr[x][y] !== 0) return;

	app.forSiblingsCells( x, y, function( x1, y1 ){
		if( app.User[x1][y1] === 0 ){
			app.FillBlank( x1, y1 );
		}
	} );

};

// Подсказка (не Чит) для тех у кого проблемы с усным счетом
app.CheckCell = function( x, y ) {
	app.DoneCheat = true;
	app.CheatX = x;
	app.CheatY = y;

	var nFlags = 0;
	app.forSiblingsCells( x, y, function( x1, y1 ){
		if( app.User[x1][y1] == 2 ) nFlags++;
	} );

	if( nFlags == app.Matr[x][y] ) {
		app.forSiblingsCells( x, y, function( x1, y1 ){
			if( app.User[x1][y1] === 0 ){
				app.cellClick( x1, y1 );
			}
		} );
	}  

	if( nFlags < app.Matr[x][y] ) {
		app.forSiblingsCells( x, y, function( x1, y1 ){
			if( app.User[x1][y1] === 0 ){ 
				app.setIcon( x1, y1, "down" );
				app.setIcon( x, y, app.Matr[x][y]-nFlags );
			}
		} );
	}  

};

// Перебор всех ячеек
app.forAllCells = function( callback ){
	for( y = 0; y < app.H; y++){
		for( x = 0; x < app.W; x++) {
			callback( x, y );
		}
	}
};

// Перебор ячеек, окружающих выбранную ячейку
app.forSiblingsCells = function( x, y, callback ){
	for( var i1 = x-1; i1 <= x+1; i1++ ){
		for( var j1=y-1; j1<=y+1; j1++ ){
			if( !(i1==x && j1==y) && i1 >= 0 && i1 < app.W && j1 >= 0 && j1 < app.H ){
				callback( i1, j1 );
			}
		}
	}
};

app.clearField = function(){
	var html = "", y=0, x=0;
	for(; y < app.H; y++ ){
		html += "<div class='field-row'>";
		for( x=0; x < app.W; x++ ){
			html += "<i class='field-cell ico-blank' id='iCell_" + x + "_" + y + "' data-x='" + x + "' data-y='" + y + "'></i>";
		}
		html += "</div>";
	}
	$(".field").html( html );
	$(".field-cell").on( "mousedown", app.cellMouseDown );
	$(".field-cell").on( "mouseup", app.cellMouseUp );
	$(".field-cell").on( "contextmenu", app.prevent );
	$(".field-row").css({'min-width': 1 + app.W * $(".field-cell:first").width() + 'px'});

	// Сгенерируем мины   
	for( var j = 0; j < app.MineCount; j++) {
		do{
			x = Math.round((app.W-1) * Math.random());
			y = Math.round((app.H-1) * Math.random());    
		}
		while( app.Matr[x][y] !== 0 );
		app.Matr[x][y] = 9;    
	}

    // Расставим цифры  
	var nMines=0;
	app.forAllCells(function( x, y ){
		if( app.Matr[x][y] < 9 ){
			nMines = 0;
			app.forSiblingsCells( x, y, function( x1, y1 ){
				if( app.Matr[x1][y1] == 9 ){
					nMines++;
				}
			} );
			app.Matr[x][y] = nMines;
		}
	});
};

app.showAll = function( ){
	for( var y = 0; y < app.H; y++ ){
		for( var x = 0; x < app.W; x++ ){
			if( app.Matr[x][y] == 9 ){
				app.setIcon( x, y, "coolmine");
			}
			else{
				app.setIcon( x, y, app.Matr[x][y] );
			}
		}
	}
};

app.setTime = function( n ){
	n = parseInt( n, 10 );
	app.CurTime = n;
	$("#dTime").text( n );
};

app.setMinesLeft = function( n ){
	n = parseInt( n, 10 );
    app.MinesLeft = n;
	$("#dMinesLeft").text( n );
};

app.menuInit = function(){
	$(".menu-item").click(function(){
		$( this ).addClass('active').siblings().removeClass('active');
		$(".page").removeClass("active");
		$($(this).data('target')).addClass("active").siblings().removeClass("active");
	});
};

app.loadLang = function( ){
	app.oLayout = document.getElementById("layout");
	app.platformLanguage = navigator && (navigator.language || navigator.browserLanguage || navigator.systemLanguage || navigator.userLanguage || "en-EN");
	app.platformLanguage = app.platformLanguage.split("-")[0];

	app.loadScript( "js/lang_" + app.platformLanguage + ".js", function(){
		if( !lang ){ 
			console.log("lang file not loaded");
			return;
		}
		var html = app.oLayout.innerHTML;
		for( var v in lang ){
			html = html.replace( new RegExp( "{" + v + "}", "g" ), lang[v] );
		}
		app.oLayout.innerHTML = html;
		$( app.oLayout ).removeClass("hidden");
		app.init();
	});
};

app.loadScript = function(u, c) {
	var e = document.createElement('SCRIPT');
	e.setAttribute('src', u);
	if (typeof c == "function") {
		e.addEventListener('load', c);
	}
	document.head.appendChild(e);
};

$(window).on("load", app.loadLang);









