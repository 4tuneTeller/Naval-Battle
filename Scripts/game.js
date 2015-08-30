(function ($) { // реализуем нашу игру как плагин jQuery, для ограничения области видимости и избежания конфликтов обернем его в модуль

var settings;

var ShipRotation = { // объект перечисления состояний поворота кораблей
    HORIZONTAL: 0,
    VERTICAL: 1
};

var TurnResult = {
    MISSED: 0,
    HIT: 1,
    KILLED: 2,
    VICTORY: 3
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

function bind(func, context) { // функция дли привязки контекста, напишем её сами для поддержки ie8-
  return function() { 
    return func.apply(context, arguments);
  };
}

function getRandomInt(min, max) { 
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function BattleShip (size, rotation) { // конструктор объектов кораблей
    this.rotation = rotation; // расположение корабля (вертикальное или горизонтальное)
    this.size = size; // размер в клетках
    this.coords = new Array(); // все координаты, в которых расположен корабль
    
    var health = size; // "здоровье" корабля - сколько клеток остались непораженными
    var isFlipped = false; // поворачивался ли корабль
    this.isFlipped = function () { // getter для isFlipped (чтобы нельзя было вручную поменять это значение - оно меняется только функцией flip)
        return isFlipped;
    }
    var isAlive = true; // жив ли корабль
    this.isAlive = function () { // getter
        return isAlive;
    }
    
    this.hit = function () { // функция попадания по кораблю: отнимает единичку "здоровья" (одну клетку подстрелили) и если все клетки корабля поражены - ставит переменную isAlive в false
        if (--health <= 0) {
            isAlive = false;
        }
        return isAlive;
    }
    
    this.flip = function () { // функция поворота корабля (на случай, если в изначальном положении корабль не влезет в поле)
        if (this.rotation == 0) {
            this.rotation = 1;
        } else {
            this.rotation = 0;
        }
        isFlipped = true;
    }
}

function coordsSum(coord1, coord2) {
    return { x: coord1.x + coord2.x, y : coord1.y + coord2.y };
}
function coordsMult(coords, num) {
    var result = new Array();
    for (var i = 0; i < coords.length; i++) {
        result.push({ x: coords[i].x * num, y: coords[i].y * num });
    }
    return result;
}

function ComputerAI(playerField) {
    //var isFoundShip = false;
    var lastShot = null;
    var initHit = null;
    var foundShipDirection = false;
    var shootBackward = false;
    var shootAroundTryCount = -1;
    var coordsToTry = [{ x: 0, y: 1 },
                       { x: 0, y: -1 },
                       { x: 1, y: 0 },
                       { x: -1, y: 0 }];
    
    this.takeTurn = function() {
        var coords;
        
        if (lastShot == null) {
            coords = playerField.getNextUnhitCoords(getRandomInt(1, settings.fieldWidth), getRandomInt(1, settings.fieldHeight));
        } else {
            if (shootBackward) {
                coords = coordsSum(lastShot, coordsToTry[shootAroundTryCount]);
            } else if (foundShipDirection) {
                coords = coordsSum(lastShot, coordsToTry[shootAroundTryCount]);
            } else do {
                shootAroundTryCount++;
                coords = coordsSum(lastShot, coordsToTry[shootAroundTryCount]); // находим координату вокруг последнего попадания
            } while (coords.x < 1 || coords.x > settings.fieldWidth || coords.y < 1 || coords.y > settings.fieldHeight
                     || playerField.getCellInCoords(coords.x, coords.y).getHitState() != CellHitType.NONE) // проверка на допустимость полученных координат
        }
        
        var turnResult = playerField.hit(coords.x, coords.y);
        if (turnResult == TurnResult.HIT) {
            if (lastShot != null) {
                foundShipDirection = true;
            } else {
                initHit = coords;
            }
            lastShot = coords;
        } else if (turnResult == TurnResult.KILLED) {
            lastShot = null;
            shootAroundTryCount = -1;
            foundShipDirection = false;
            shootBackward = false;
            initHit = null;
        } else if (foundShipDirection && turnResult == TurnResult.MISSED) {
            shootBackward = true;
            lastShot = initHit;
            coordsToTry = coordsMult(coordsToTry, -1);
        }
        
        return turnResult;
    }
}

function GameManager(gameBoard, playerName) {
    var isPlayerTurn = true;
    var computerAI, playerField, computerField;
    
    function switchTurn () {
        isPlayerTurn = !isPlayerTurn;
        this.makeTurn();
    }
    
    this.startGame = function () {
        playerField = new GameFieldManager(true);
        computerField = new GameFieldManager(false);
        
        generateShips(playerField);
        generateShips(computerField);
        
        computerAI = new ComputerAI(playerField);
        //computerAI2 = new ComputerAI(computerField);
        
        playerField.fieldCaption.append("<span>Ход компьютера:</span>");
        computerField.fieldCaption.append("<span>Ваш ход, " + playerName + ":</span>");
        
        gameBoard.append(playerField.getFieldDiv());
        gameBoard.append(computerField.getFieldDiv());
        
        this.makeTurn();
    }
    
    function restartGame() {
        gameBoard.empty();
        this.startGame();
    }
    
    this.makeTurn = function () {
        if (isPlayerTurn) {
            playerField.fieldCaption.css("visibility", "hidden");
            computerField.fieldCaption.css("visibility", "visible");
            playerField.getFieldDiv().removeClass("game-field-active");
            computerField.getFieldDiv().addClass("game-field-active");
            computerField.bindClickEvents(bind(cellClicked, this));
            //setTimeout(bind(function () { computerTurn(computerAI2, this); }, this), settings.computerWaitTime);
        } else {
            playerField.fieldCaption.css("visibility", "visible");
            computerField.fieldCaption.css("visibility", "hidden");
            playerField.getFieldDiv().addClass("game-field-active");
            computerField.getFieldDiv().removeClass("game-field-active");
            computerField.unBindClickEvents();
            
            setTimeout(bind(function () { computerTurn(computerAI, this); }, this), settings.computerWaitTime);
        }
    }
    
    function computerTurn(computer, me) {
        switch (computer.takeTurn()) {
            case TurnResult.MISSED:
                switchTurn.call(me)
                break
            case TurnResult.HIT:
                setTimeout(function () { computerTurn(computer, me); }, settings.computerWaitTime)
                break
            case TurnResult.KILLED:
                setTimeout(function () { computerTurn(computer, me); }, settings.computerWaitTime)
                break
            case TurnResult.VICTORY:
                restartGame.call(me)
                break
            default:
                console.log("Error: Unexpected value")
        }
        //if (computerAI.takeTurn() == TurnResult.MISSED) {
        //    setTimeout(function () { computerTurn(me); }, settings.computerWaitTime);
        //} else {
        //    switchTurn.call(me);
        //}
    }
    
    function cellClicked (event) { // обработчик события нажатия на клетку игрового поля
        switch (computerField.hit(event.data.x, event.data.y)) {
            case TurnResult.MISSED:
                switchTurn.call(this)
                break
            case TurnResult.HIT:
                break
            case TurnResult.KILLED:
                break
            case TurnResult.VICTORY:
                restartGame.call(this)
                break
            default:
                console.log("Error: Unexpected value")
        }
    }
}

function GameFieldManager (isPlayer) { // создадим конструктор объекта для работы с игровым полем (параметр указывает, является ли создаваемое поле полем игрока или полем компьютера)
    var gameField = new Array(settings.fieldHeight); // массив для хранения ссылок на объекты jQuery (ячейки игрового поля)
    this.fieldCaption = $("<div>").addClass("game-field-caption");
    //this.isPlayer = function () { // getter параметра isPlayer
    //    return isPlayer;
    //}
    
    this.getCellInCoords = function (x, y) { // функция получения объекта клетки по координатам
        if (x > 0 && x <= settings.fieldWidth && y > 0 && y <= settings.fieldHeight) {
            return gameField[x][y];
        }
        else return new FieldCell(-1, -1, null); // если заданы некорректны координаты - вернем "несуществующую" клетку, любые манипуляции с ней никак не повлияют на игру
    }
    
    function getCellsAroundCoords(x, y, fieldManager) { // функция для получения всех клеток вокруг клетки с координатами x и y
        return [fieldManager.getCellInCoords(x - 1, y),
                fieldManager.getCellInCoords(x - 1, y - 1),
                fieldManager.getCellInCoords(x - 1, y + 1),
                fieldManager.getCellInCoords(x, y + 1),
                fieldManager.getCellInCoords(x, y - 1),
                fieldManager.getCellInCoords(x + 1, y),
                fieldManager.getCellInCoords(x + 1, y + 1),
                fieldManager.getCellInCoords(x + 1, y - 1)];
    }
    
    var shipsOnField = new Array(); // массив для хранения кораблей на поле
    
    function addShip(ship) { // функция добавления корабля на поле
        for (var ci = 0; ci < ship.coords.length; ci++) { // пройдемся по всем координатам корабля, пометим соответсвующие клетки корабля как заняты, а клетки вокруг - как недоступные для размещения в них новых кораблей
            var c = ship.coords[ci];
            this.getCellInCoords(c.x, c.y).occupy();
            var cellsAround = getCellsAroundCoords(c.x, c.y , this);
            for (var i = 0; i < cellsAround.length; i++) {
                cellsAround[i].reserv();
            }
        }
        
        shipsOnField.push(ship); // добавляем корабль в массив для последующего доступа к нему
    }
        
    
    this.getFieldDiv = function () { // getter объекта таблицы с полем (сам объект у нас приватный)
        return _$fieldDiv;
    }
    
    function getNextFreeCoords(initX, initY, maxX, maxY) {
        return getNextCoords(initX, initY, maxX, maxY, true);
    }
    
    this.getNextUnhitCoords = function(initX, initY) {
        return getNextCoords(initX, initY, settings.fieldWidth, settings.fieldHeight, false);
    }
    
    function getNextCoords(initX, initY, maxX, maxY, isFindFree) {
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
        
        while (isFindFree
               ? gameField[curX][curY].getOccupationState() != CellOccupationType.FREE
               : gameField[curX][curY].getHitState() != CellHitType.NONE)
        {
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
    
    this.putShipRandom = function (ship) {
        var isHor = Number(ship.rotation == ShipRotation.HORIZONTAL);
        var isVert = Number(ship.rotation == ShipRotation.VERTICAL);
        var maxX = settings.fieldWidth - isHor * (ship.size - 1);
        var maxY = settings.fieldHeight - isVert * (ship.size - 1);
        
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
            var tmpFirstCoord = getNextFreeCoords(startX, startY, maxX, maxY);
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
                maxX = settings.fieldWidth - isHor * (ship.size - 1);
                maxY = settings.fieldHeight - isVert * (ship.size - 1);
            }
        }
        
        ship.coords = foundCoords;
        addShip.call(this, ship);
    }
    
    function getShipInCoords(x, y) { // функция получения корабля, расположенного по заданным координатам
        for (var s = 0; s < shipsOnField.length; s++) {
            for (var c = 0; c < shipsOnField[s].coords.length; c++) {
                if (shipsOnField[s].coords[c].x == x && shipsOnField[s].coords[c].y == y) {
                    return shipsOnField[s];
                }
            }
        }
        
        return null;
    }
    
    this.hit = function (x, y) { // функция реакции на попадание по клетке игрового поля
        gameField[x][y].hit();
        var shipInCoords = getShipInCoords(x, y);
        if (shipInCoords != null) {
            if (!shipInCoords.hit()) { // если в клетке находился корабль, проверяем, не убит ли он
                for (var ci = 0; ci < shipInCoords.coords.length; ci++) { // пройдемся по всем координатам корабля, пометим клетки вокруг него как пораженные - чтобы было ясно, что по ним стрелять уже нет смысла
                    var c = shipInCoords.coords[ci];
                    this.getCellInCoords(c.x, c.y).hit(); 
                    var cellsAround = getCellsAroundCoords(c.x, c.y, this);
                    for (var i = 0; i < cellsAround.length; i++) {
                        cellsAround[i].hit();
                    }
                }
                // проверка на победу
                var isVictory = true;
                for (var s = 0; s < shipsOnField.length; s++) {
                    if (shipsOnField[s].isAlive()) {
                        isVictory = false;
                        break;
                    }
                }
                if (isVictory) {
                    if (!isPlayer) {
                        alert("Вы выиграли! :)"); // если разгорм на поле противника - то игрок выиграл
                    } else {
                        alert("Вы проиграли! :("); // если на поле игрока - игрок проиграл
                    }
                    return TurnResult.VICTORY;
                }
                return TurnResult.KILLED;
            }
            return TurnResult.HIT; // если попали по кораблю - возвращаем 1
        } else {                   // иначе - 0
            return TurnResult.MISSED;
        }
    }
    
    this.bindClickEvents = function (clickEvent) {
        if (isPlayer) return;
        
        for (var i = 1; i < gameField.length; i++) {
            for (var j = 1; j < gameField[i].length; j++) {
                gameField[i][j].bindClickEvent(clickEvent);
            }
        }
    }
    
    this.unBindClickEvents = function () {
        if (isPlayer) return;
        
        for (var i = 1; i < gameField.length; i++) {
            for (var j = 1; j < gameField[i].length; j++) {
                gameField[i][j].unBindClickEvent();
            }
        }
    }
    
    //function cellClicked (event) { // обработчик события нажатия на клетку игрового поля
    //    this.hit(event.data.y, event.data.x);
    //}
    
    function FieldCell(x, y, jqObject) { // конструктор объекта ячейки
        this.cellObject = jqObject; // jQuery объект ячейки
        
        var hitState = CellHitType.NONE; // состояние попадания по ячейке
        var occupationState = CellOccupationType.FREE; // состояние ячейки (занята ли)
        
        this.getOccupationState = function () {
            return occupationState;
        }
        
        this.getHitState = function () {
            return hitState;
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
        
        function hitEffectRemove() { // убираем эффект попадания
            if (occupationState == CellOccupationType.OCCUPIED) {
                this.cellObject.removeClass("game-field-cell-hit-effect");
                this.cellObject.addClass("game-field-cell-hit");
            } else {
                this.cellObject.removeClass("game-field-cell-missed-effect");
                this.cellObject.addClass("game-field-cell-missed");
            }
        }
        
        this.hit = function () { // функция попадания по клетке
            if (hitState != CellHitType.NONE || this.cellObject == null) return;
            
            if (occupationState == CellOccupationType.OCCUPIED) {
                hitState = CellHitType.HIT;
                this.cellObject.removeClass("game-field-cell-with-ship");
                this.cellObject.addClass("game-field-cell-hit-effect");
            } else {
                hitState = CellHitType.MISSED;
                this.cellObject.addClass("game-field-cell-missed-effect");
            }
            
            setTimeout(bind(hitEffectRemove, this), 1000);
            
            this.unBindClickEvent();
            //this.cellObject.removeClass("game-field-cell-clickable");
            //this.cellObject.off("click");
        }
        
        this.bindClickEvent = function (clickEvent) {
            if (hitState != CellHitType.NONE || this.cellObject == null) return;
            
            this.cellObject.addClass("game-field-cell-clickable"); // если ячейка является частью поля врага - добавляем класс для нажимания ячейки
            //var clickFunc = bind(clickEvent, this); // привязываем контекст текущего объекта GameFieldManager к функции, которую будем вызывать по нажатию на ячейку
            this.cellObject.on("click", { // привязка события к ячейке
                    x: x, // расположение ячейки в таблице
                    y: y
                }, clickEvent);
        }
        
        this.unBindClickEvent = function () {
            this.cellObject.removeClass("game-field-cell-clickable");
            this.cellObject.off("click");
        }
        
        function showShip (me) {
            me.cellObject.addClass("game-field-cell-with-ship");
        }
    }
    
    var _$fieldDiv = (function() { // эта функция запустится сразу при создании нового объекта GameFieldManager и сгенерирует игровое поле
        var $fieldDiv = $("<div>").addClass("game-field"); // создаем jQuery-объект таблицы для игрового поля
        $fieldDiv.append(this.fieldCaption);
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
                    //if (!isPlayer) {
                    //    $tableCell.addClass("game-field-cell-clickable"); // если ячейка является частью поля врага - добавляем класс для нажимания ячейки
                    //    var clickFunc = bind(cellClicked, this); // привязываем контекст текущего объекта GameFieldManager к функции, которую будем вызывать по нажатию на ячейку
                    //    $tableCell.on("click", { // привязка события к ячейке
                    //            x: i, // расположение ячейки в таблице
                    //            y: j
                    //        }, clickFunc); // функция, которая будет вызываться по нажатии на ячейку
                    //}
                }
                if (i != 0 && j != 0) { // добавляем ячейки игрового поля в массив
                    if (i == 1) {
                        gameField[j] = new Array(settings.fieldWidth); // инициализируем новую строку в массиве
                    }
                    gameField[j][i] = new FieldCell(j, i, $tableCell); // сохраняем объект ячейки в массив для последующего доступа
                }
                $tableRow.append($tableCell); // добавляем сгенерированные ячейки в строку таблицы
            }
            $fieldDiv.append($tableRow); // добавляем сгенерированные строки в таблицу
        }
        
        return $fieldDiv;
    }).call(this);
}

function generateShips(gameFieldManager) { // функция генерации кораблей
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
       fieldHeight: 10,
       computerWaitTime: 1000
    }, options );
    
    this.empty();
    
    //var playerField = new GameFieldManager(true); // создаем объект для поля игрока
    //var computerField = new GameFieldManager(false); // создаем объект для поля компьютера
    
    //this.append(playerField.getFieldDiv()); // добавляем поле игрока в div, к которому подключен наш jQuery плагин
    //this.append(computerField.getFieldDiv());
    
    //generateShips(playerField);
    //generateShips(computerField);
    
    var gameManager = new GameManager(this, prompt("Здравствуйте! Пожалуйста, введите ваше имя:"));
    gameManager.startGame();
    //gameManager.makeTurn();
    //playerField.hit(2, 3);
}

}(jQuery));