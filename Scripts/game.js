(function ($) { // реализуем нашу игру как плагин jQuery, для ограничения области видимости и избежания конфликтов обернем его в модуль

var settings;

var ShipRotation = { // объект перечисления состояний поворота кораблей
    HORIZONTAL: 0,
    VERTICAL: 1
};

function bind(func, context) { // функция дли привязки контекста, напишем её сами для поддержки ie8-
  return function() { 
    return func.apply(context, arguments);
  };
}

function getRandomInt(min, max) { 
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function BattleShip (size, rotation) { // конструктор объектов кораблей
    this.rotation = rotation;
    this.size = size;
    this.coords = new Array();
    this.isAlive = true;
    
    var isFlipped = false;
    this.isFlipped = function () {
        return isFlipped;
    }
    
    this.flip = function () {
        if (this.rotation == 0) {
            this.rotation = 1;
        } else {
            this.rotation = 0;
        }
        isFlipped = true;
    }
}

function GameFieldManager (isPlayer) { // создадим конструктор объекта для работы с игровым полем
    //this.isPlayer = isPlayer;
    var gameField = new Array(settings.fieldHeight); // массив для хранения ссылок на объекты jQuery (ячейки игрового поля)
    
    this.getCellInCoords = function (x, y) {
        if (x > 0 && x <= settings.fieldWidth && y > 0 && y <= settings.fieldHeight) {
            return gameField[x][y];
        }
        else return new FieldCell(null);
    }
    
    var shipsOnField = new Array(); // массив для хранения кораблей на поле
    
    function addShip(ship) {
        for (var ci = 0; ci < ship.coords.length; ci++) {
            var c = ship.coords[ci];
            this.getCellInCoords(c.x, c.y).occupy();
            this.getCellInCoords(c.x - 1, c.y).reserv();
            this.getCellInCoords(c.x - 1, c.y - 1).reserv();
            this.getCellInCoords(c.x - 1, c.y + 1).reserv();
            this.getCellInCoords(c.x, c.y + 1).reserv();
            this.getCellInCoords(c.x, c.y - 1).reserv();
            this.getCellInCoords(c.x + 1, c.y).reserv();
            this.getCellInCoords(c.x + 1, c.y + 1).reserv();
            this.getCellInCoords(c.x + 1, c.y - 1).reserv();
        }
        //gameField[c.x][c.y].showShip();
        shipsOnField.push(ship);
    }
        
    
    this.getPlayerFieldDiv = function () { // функция получения объекта таблицы с полем (сам объект у нас скрытый, как бы private)
        return _$playerFieldDiv;
    }
    
    this.putShipRandom = function (ship) {
        var isHor = Number(ship.rotation == ShipRotation.HORIZONTAL);
        var isVert = Number(ship.rotation == ShipRotation.VERTICAL);
        var maxX =settings.fieldWidth - isHor * (ship.size - 1);
        var maxY =settings.fieldHeight - isVert * (ship.size - 1);
        
        function getNextFreeCoords(initX, initY) {
            var curX = initX;
            var curY = initY;
            if (curX > maxX) {
                curX = 1;
                if (++curY > maxY) {
                    curY = 1;
                } 
            } else if (curY > maxY) {
                curY = 1;
                curX = 1;
            }
            while (gameField[curX][curY].getOccupationState() != CellOccupationType.FREE) {
                if (++curX > maxX) {
                    if (++curY > maxY) {
                        curY = 1;
                    }
                    curX = 1;
                }
                if (curX == initX && curY == initY) {
                    console.log("No free space found");
                    return null;
                }
            }
            return {x: curX, y: curY};
        }
        //var shipWidth = (ship.rotation == ShipRotation.HORIZONTAL) ? ship.size : 1;
        //var shipHeight = (ship.rotation == ShipRotation.VERTICAL) ? ship.size : 1;
        var randX = getRandomInt(1, maxX);
        var randY = getRandomInt(1, maxY);
        //var randX = initRandX;
        //var randY = initRandY;
        var foundRoom = false;
        var foundCoords;
        var startX = randX;
        var startY = randY;
        
        //var debugStartTime = new Date().getTime();
        
        while (!foundRoom) {
            
            //var debugEndTime = new Date().getTime();
            //if (debugEndTime - debugStartTime > 2000) {
            //    console.log("not enought free space X:" + randX + " Y:" + randY);
            //    debugger;
            //    //return;
            //}
            
            foundCoords = new Array();
            var tmpFirstCoord = getNextFreeCoords(startX, startY);
            if (tmpFirstCoord == null) return;
            
            foundCoords.push(tmpFirstCoord);
            foundRoom = true;
            for (var i = 1; i < ship.size; i++) {
                var tmpX = tmpFirstCoord.x + i * isHor;
                var tmpY = tmpFirstCoord.y + i * isVert;
                if (gameField[tmpX][tmpY].getOccupationState() == CellOccupationType.FREE) {
                    foundCoords.push({x:tmpX, y:tmpY});
                }
                else {
                    if (++startX > maxX) {
                        if (++startY > maxY) {
                            startY = 1;
                        }
                        startX = 1;
                    }
                    //startY = tmpY;
                    foundRoom = false;
                    break;
                }
            }
            if (!foundRoom && startX == randX && startY == randY) {
                if (ship.isFlipped()) {
                    console.log("Not enought free space for the ship");
                    return;
                }
                ship.flip();
                isHor = Number(ship.rotation == ShipRotation.HORIZONTAL);
                isVert = Number(ship.rotation == ShipRotation.VERTICAL);
                maxX =settings.fieldWidth - isHor * (ship.size - 1);
                maxY =settings.fieldHeight - isVert * (ship.size - 1);
            }
        }
        
        ship.coords = foundCoords;
        addShip.call(this, ship);
    }
    
    function getShipInCoords(x, y) {
        for (var s = 0; s < shipsOnField.length; s++) {
            for (var c = 0; c < shipsOnField[s].coords.length; c++) {
                if (shipsOnField[s].coords[c].x == x && shipsOnField[s].coords[c].y == y) {
                    return shipsOnField[s];
                }
            }
        }
        
        return null;
    }
    
    this.hit = function (x, y) {
        gameField[x][y].hit();
        var shipInCoords = getShipInCoords(x, y);
        if (shipInCoords != null) {
            console.log("Попадание по кораблю размером " + shipInCoords.size);
        }
    }
    
    function cellClicked (event) {
        this.hit(event.data.y, event.data.x);
    }
    
    var CellOccupationType = { // объект перечисления состояния занятости ячеек
        FREE: 0, // свободная ячейка
        OCCUPIED: 1, // ячейка занята кораблем
        UNAVAILABLE: 2 // соседняя с кораблем ячейка (в ней нельзя размещать новые корабли)
    }
    
    var CellHitType = { // объект перечисления состояния попадания ячеек
        NONE: 0, // в ячейку не стреляли
        MISSED: 1, // в ячейку стреляли, но по кораблю не попали
        HIT: 2, // в ячейку стреляли, по кораблю попали
        KILLED: 3 // в ячейку стреляли, корабль потоплен
    }
    
    function FieldCell(jqObject) { // конструктор объекта ячейки
        this.cellObject = jqObject; // jQuery объект ячейки
        
        var hitState = CellHitType.NONE; // состояние попадания по ячейке
        var occupationState = CellOccupationType.FREE; // состояние ячейки (занята ли)
        
        this.getOccupationState = function () {
            return occupationState;
        }
        
        this.occupy = function () {
            occupationState = CellOccupationType.OCCUPIED;
            if (isPlayer) showShip(this);
        }
        
        this.reserv = function () {
            if (occupationState != CellOccupationType.OCCUPIED) {
                occupationState = CellOccupationType.UNAVAILABLE;
            }
        }
        
        this.hit = function () { // функция попадания по ячейке
            if (occupationState == CellOccupationType.OCCUPIED) {
                hitState = CellHitType.HIT;
                this.cellObject.removeClass("game-field-cell-with-ship");
                this.cellObject.addClass("game-field-cell-hit");
            } else {
                hitState = CellHitType.MISSED;
                this.cellObject.addClass("game-field-cell-missed");
            }
            this.cellObject.removeClass("game-field-cell-clickable");
            this.cellObject.off("click");
        }
        
        function showShip (me) {
            me.cellObject.addClass("game-field-cell-with-ship");
        }
    }
    
    var _$playerFieldDiv = (function() { // эта функция запустится сразу при создании нового объекта GameFieldManager и сгенерирует игровое поле
        var $playerFieldDiv = $("<div>").addClass("game-field"); // создаем jQuery-объект таблицы для игрового поля
        var initCharCode = "А".charCodeAt(0); // получаем код символа буквы А, для генерации
        var charToSkipCharCode = "Й".charCodeAt(0); // код буквы Й, для того, чтобы ее пропустить
        
        for (var i = 0; i <settings.fieldHeight + 1; i++) { // цикл генерации строк таблицы
            var $tableRow = $("<div>"); // создаем строку
            if (i == 0) {
                $tableRow.addClass("game-field-letters-row"); // если строка первая - задаем ей класс для первой строки
            } else {
                $tableRow.addClass("game-field-row"); // иначе - класс простой строки
            }
            
            for (var j = 0; j <settings.fieldWidth + 1; j++) { // цикл генерации ячеек для таблицы
                //var tableCell = new FieldCell($("<div>")); 
                var $tableCell = $("<div>"); // создаем ячейку
                if (i == 0 || j == 0) {
                    $tableCell.addClass("game-field-headers-cell"); // если ячейка является первой в столбце или строке - задаем ей класс ячеек с нумерацией
                    if (i == 0 && j != 0) { // если ячейка является первой в столбце - заполняем её порядковой буквой
                        var currentCharCode = initCharCode + j;
                        $tableCell.text(String.fromCharCode(currentCharCode - (currentCharCode <= charToSkipCharCode ? 1 : 0))); // в строке - проверка для пропуска буквы Й
                    } else if (i != 0 && j == 0) { // если ячейка является первой в строке - заполняем её порядковой цифрой
                        $tableCell.text(i);
                    }
                } else {
                    $tableCell.addClass("game-field-cell"); // если ячейка является частью игрового поля - присваиваем ей соответсвующий класс
                    if (!isPlayer) {
                        $tableCell.addClass("game-field-cell-clickable"); // если ячейка является частью поля врага - добавляем класс для нажимания ячейки
                        var clickFunc = bind(cellClicked, this); // привязываем контекст текущего объекта GameFieldManager к функции, которую будем вызывать по нажатию на ячейку
                        $tableCell.on("click", { // привязка события к ячейке
                                x: i, // расположение ячейки в таблице
                                y: j
                            }, clickFunc); // функция, которая будет вызываться по нажатии на ячейку
                    }
                }
                if (i != 0 && j != 0) { // добавляем ячейки игрового поля в массив
                    if (i == 1) {
                        gameField[j] = new Array(settings.fieldWidth); // инициализируем новую строку в массиве
                    }
                    gameField[j][i] = new FieldCell($tableCell); // сохраняем объект ячейки в массив для последующего доступа
                }
                $tableRow.append($tableCell); // добавляем сгенерированные ячейки в строку таблицы
            }
            $playerFieldDiv.append($tableRow); // добавляем сгенерированные строки в таблицу
        }
        
        return $playerFieldDiv;
    }).call(this);
}

function generateShips(gameFieldManager) {
    gameFieldManager.putShipRandom(new BattleShip(1, ShipRotation.HORIZONTAL));
    gameFieldManager.putShipRandom(new BattleShip(1, ShipRotation.HORIZONTAL));
    gameFieldManager.putShipRandom(new BattleShip(1, ShipRotation.HORIZONTAL));
    gameFieldManager.putShipRandom(new BattleShip(1, ShipRotation.HORIZONTAL));
    gameFieldManager.putShipRandom(new BattleShip(2, getRandomInt(0, 1)));
    gameFieldManager.putShipRandom(new BattleShip(2, getRandomInt(0, 1)));
    gameFieldManager.putShipRandom(new BattleShip(2, getRandomInt(0, 1)));
    gameFieldManager.putShipRandom(new BattleShip(3, getRandomInt(0, 1)));
    gameFieldManager.putShipRandom(new BattleShip(3, getRandomInt(0, 1)));
    gameFieldManager.putShipRandom(new BattleShip(4, getRandomInt(0, 1)));
}

$.fn.makeGame = function (options) {
    
    settings = $.extend({
        // размеры игрового поля (в ячейках) по умолчанию
       fieldWidth: 10,
       fieldHeight: 10
    }, options );
    
    var playerField = new GameFieldManager(true); // создаем объект для поля игрока
    var computerField = new GameFieldManager(false); // создаем объект для поля компьютера
    
    this.append(playerField.getPlayerFieldDiv()); // добавляем поле игрока в div, к которому подключен наш jQuery плагин
    this.append(computerField.getPlayerFieldDiv());
    
    generateShips(playerField);
    generateShips(computerField);
    //playerField.hit(2, 3);
}

}(jQuery));