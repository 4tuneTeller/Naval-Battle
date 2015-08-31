(function ($) { // реализуем нашу игру как плагин jQuery, для ограничения области видимости и избежания конфликтов обернем его в модуль

var settings;

var ShipRotation = { // объект перечисления состояний поворота кораблей
    HORIZONTAL: 0,
    VERTICAL: 1
};

var TurnResult = { // объект перечисления результатов попадания
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

function getRandomInt(min, max) { // функция получения случайного целого числа в заданно диапазоне
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

function coordsSum(coord1, coord2) { // функция суммирования координат
    return { x: coord1.x + coord2.x, y : coord1.y + coord2.y };
}

function coordsMult(coords, num) { // функция умножения всех координат на число
    var result = new Array();
    for (var i = 0; i < coords.length; i++) {
        result.push({ x: coords[i].x * num, y: coords[i].y * num });
    }
    return result;
}

function ComputerAI(playerField) { // конструктор объекта компьютерного противника
    var lastShot = null; // здесь будет хранитсья координата последнего попадания
    var initHit = null; // здесь будет храниться координата, по которой впервые попали по кораблю
    var foundShipDirection = false; // определено ли направление поворота корабля
    var shootBackward = false; // следует ли стрелять в обратном направлении (если следуя по координатам корабля, он вдруг закончился)
    var shootAroundTryCount = -1; // число попытока обстрела соседних с кораблем клеток
    var coordsToTry = [{ x: 0, y: 1 }, // "вектора" для обстрела соседних клеток
                       { x: 0, y: -1 },
                       { x: 1, y: 0 },
                       { x: -1, y: 0 }];
    
    this.takeTurn = function() { // компьютер делает ход
        var coords; // координаты для обстрела
        
        if (lastShot == null) { // если мы еще ни в кого не попали, стреляем в случайную клетку
            coords = playerField.getNextUnhitCoords(getRandomInt(1, settings.fieldWidth), getRandomInt(1, settings.fieldHeight));
        } else {
            if (shootBackward) { // если следует продолжать обстрел в обратном направлении (данные для этого вычислены на предыдущем ходу)
                coords = coordsSum(lastShot, coordsToTry[shootAroundTryCount]);
            } else if (foundShipDirection) { // если найдено направление, в котором следует обстреливать корабль
                coords = coordsSum(lastShot, coordsToTry[shootAroundTryCount]);
                // проверка на выход за пределы поля:
                if (verifyCoords(coords, playerField)) { // если вышли за пределы поля - "разворачиваем" наши вектора для обстрела
                    coords = coordsSum(initHit, coordsToTry[shootAroundTryCount]);
                }
            } else do { // если направление для обстрела не найдено, но на предыдущем ходу мы в кого-то попали, пытаемся найти направление, в котором следует продолжать обстрел
                shootAroundTryCount++;
                coords = coordsSum(lastShot, coordsToTry[shootAroundTryCount]); // находим координату вокруг последнего попадания
            } while (verifyCoords(coords, playerField)) // проверка на допустимость полученных координат
        }
        
        var turnResult = playerField.hit(coords.x, coords.y); // совершаем выстрел и смотрим результаты
        if (turnResult == TurnResult.HIT) { // если попали в кого-то
            if (lastShot != null) { // если до этого уже попадали в этот корабль, записываем, что нашли направление для дальнейшей стрельбы
                foundShipDirection = true;
            } else { // если не попадали - сохраняем место первого попадания по этому кораблю
                initHit = coords;
            }
            lastShot = coords; // сохраняем место последнего попадания по кораблю
        } else if (turnResult == TurnResult.KILLED) { // если убили корабль - сбрасываем все что запомнили
            lastShot = null;
            shootAroundTryCount = -1;
            foundShipDirection = false;
            shootBackward = false;
            initHit = null;
        } else if (foundShipDirection && turnResult == TurnResult.MISSED) { // если мы стреляли по направлению корабля, но он вдруг закончился - значит, надо стрелять по нему с другой стороны
            shootBackward = true; // сохраняем, что надо на следующем ходу стрелять с другой стороны
            lastShot = initHit; // и что надо начать стрелять с того места, в которое попали первый раз
            coordsToTry = coordsMult(coordsToTry, -1); // "разворачиваем" вектора стрельбы
        }
        
        return turnResult; // возвращаем результаты выстрела
    }
    
    function verifyCoords(coords, gameField) { // функция проверки координат на возможность стрельбы
        return coords.x < 1 || coords.x > settings.fieldWidth || coords.y < 1 || coords.y > settings.fieldHeight
                    || gameField.getCellInCoords(coords.x, coords.y).getHitState() != CellHitType.NONE;
    }
}

function GameManager(gameBoard, playerName) { // конструктор объекта управления игрой
    var isPlayerTurn = true;
    var computerAI, playerField, computerField;
    
    function switchTurn () { // переключение хода
        isPlayerTurn = !isPlayerTurn;
        this.makeTurn();
    }
    
    this.startGame = function () { // начало игры
        playerField = new GameFieldManager(true); // создаем игровые поля
        computerField = new GameFieldManager(false);
        
        generateShips(playerField); // генерируем корабли на полях
        generateShips(computerField);
        
        computerAI = new ComputerAI(playerField); // создаем объект компьютерного соперника (если немножко поменять код GameManager'а, можно заставить играть компьютер самого с собой :)
        //computerAI2 = new ComputerAI(computerField);
        
        playerField.fieldCaption.append("<span>Ход компьютера:</span>"); // заполняем заголовок таблиц
        computerField.fieldCaption.append("<span>Ваш ход, " + playerName + ":</span>");
        
        gameBoard.append(playerField.getFieldDiv()); // размещаем сгенерированные игровые поля в div'е нашего плагина
        gameBoard.append(computerField.getFieldDiv());
        
        this.makeTurn(); // начинаем ходить
    }
    
    function restartGame() { // функция перезапуска игры
        gameBoard.empty();
        this.startGame();
    }
    
    this.makeTurn = function () { // функция выполнения хода
        if (isPlayerTurn) {
            // меняем интерфейс для отображения чей сейчас ход
            playerField.fieldCaption.css("visibility", "hidden");
            computerField.fieldCaption.css("visibility", "visible");
            playerField.getFieldDiv().removeClass("game-field-active");
            computerField.getFieldDiv().addClass("game-field-active");
            computerField.bindClickEvents(bind(cellClicked, this)); // включаем обработчики нажатий на клетки полей 
            //setTimeout(bind(function () { computerTurn(computerAI2, this); }, this), settings.computerWaitTime);
        } else {
            playerField.fieldCaption.css("visibility", "visible");
            computerField.fieldCaption.css("visibility", "hidden");
            playerField.getFieldDiv().addClass("game-field-active");
            computerField.getFieldDiv().removeClass("game-field-active");
            computerField.unBindClickEvents(); // отключаем обработчики нажатий на клетки полей
            
            setTimeout(bind(function () { computerTurn(computerAI, this); }, this), settings.computerWaitTime); // делаем небольшую паузу и разрешаем компьютеру сделать свой ход
        }
    }
    
    function computerTurn(computer, me) { // функция выполнения хода компьютером и обработка его результатов
        switch (computer.takeTurn()) {
            case TurnResult.MISSED: // если промазал - передаем ход игроку
                switchTurn.call(me)
                break
            case TurnResult.HIT: // если попал или убил - делаем паузу и даем компьютеру сходить еще раз
                setTimeout(function () { computerTurn(computer, me); }, settings.computerWaitTime)
                break
            case TurnResult.KILLED:
                setTimeout(function () { computerTurn(computer, me); }, settings.computerWaitTime)
                break
            case TurnResult.VICTORY: // если компьютер выиграл - говорим об этом игроку
                restartGame.call(me)
                break
            default:
                console.log("Error: Unexpected value") // на случай непредвиденных обстоятельств
        }
    }
    
    function cellClicked (event) { // обработчик события нажатия на клетку игрового поля (то же, что и для компьютера, только для игрока)
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

function GameFieldManager (isPlayer) { // конструктор объекта для работы с игровым полем (параметр указывает, является ли создаваемое поле полем игрока или полем компьютера)
    var gameField = new Array(settings.fieldHeight); // массив для хранения ссылок на объекты jQuery (ячейки игрового поля)
    this.fieldCaption = $("<div>").addClass("game-field-caption"); // заголовок поля
    
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
        for (var ci = 0; ci < ship.coords.length; ci++) { // пройдемся по всем координатам корабля, пометим соответсвующие клетки корабля как занятые, а клетки вокруг - как недоступные для размещения в них новых кораблей
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
    
    function getNextFreeCoords(initX, initY, maxX, maxY) { // функция-обертка получения следующих незанятых координат, после указанных (если указанные координаты свободны - возвращает их)
        return getNextCoords(initX, initY, maxX, maxY, true);
    }
    
    this.getNextUnhitCoords = function(initX, initY) { // функция-обертка получения следующих необстреленных координат, после указанных (если указанные координаты не обстрелены - возвращает их)
        return getNextCoords(initX, initY, settings.fieldWidth, settings.fieldHeight, false);
    }
    
    function getNextCoords(initX, initY, maxX, maxY, isFindFree) { // функция получения следующих координат, по одному из двух критериве (свободные или необстреленные)
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
    
    this.putShipRandom = function (ship) { // функция размещения корабля в случайном месте 
        var isHor = Number(ship.rotation == ShipRotation.HORIZONTAL);
        var isVert = Number(ship.rotation == ShipRotation.VERTICAL);
        var maxX = settings.fieldWidth - isHor * (ship.size - 1); // определяем максимальные координаты, дальше которых пробовать разместить корабль не имеет смысле (выйдет за границы поля)
        var maxY = settings.fieldHeight - isVert * (ship.size - 1);
        
        var randX = getRandomInt(1, maxX); // получаем случайные координаты
        var randY = getRandomInt(1, maxY);
        var foundRoom = false; // нашли ли место
        var foundCoords; // найденные координаты
        var startX = randX; // сохраним первоначально сгенерированные координаты, для обнаружение зацикливания при поиске места
        var startY = randY;
        
        while (!foundRoom) {
            foundCoords = new Array();
            var tmpFirstCoord = getNextFreeCoords(startX, startY, maxX, maxY);
            if (tmpFirstCoord == null) return;
            
            foundCoords.push(tmpFirstCoord); // нашли какие-то координаты, теперь будем проверять, поместится ли туда корабль
            foundRoom = true;
            for (var i = 1; i < ship.size; i++) { // пройдемся по всем координатам корабля
                var tmpX = tmpFirstCoord.x + i * isHor;
                var tmpY = tmpFirstCoord.y + i * isVert;
                if (gameField[tmpX][tmpY].getOccupationState() == CellOccupationType.FREE) { // проверяем, занята ли клетка, в которой пытаемся разместить корабль
                    foundCoords.push({x:tmpX, y:tmpY}); // если нет - сохраняем координаты
                }
                else { // иначе - идем в следующую клетку
                    if (++startX > maxX) {
                        if (++startY > maxY) {
                            startY = 1;
                        }
                        startX = 1;
                    }
                    foundRoom = false;
                    break;
                }
            }
            if (!foundRoom && startX == randX && startY == randY) { // если прошлись по всему полю, но места так и не нашли
                if (ship.isFlipped()) { // если корабль уже один раз поворачивали - говорим, что места не нашлось (такого быть не может в классических правилах Морского Боя)
                    console.log("Not enought free space for the ship");
                    return;
                }
                ship.flip(); // поворачиваем корабль и пытаемся снова найти для него место на поле
                isHor = Number(ship.rotation == ShipRotation.HORIZONTAL);
                isVert = Number(ship.rotation == ShipRotation.VERTICAL);
                maxX = settings.fieldWidth - isHor * (ship.size - 1);
                maxY = settings.fieldHeight - isVert * (ship.size - 1);
            }
        }
        
        ship.coords = foundCoords; // когда нашли место для нашего кораблья - сохраняем его координаты кораблю
        addShip.call(this, ship);  // и добавляем его на поле
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
        gameField[x][y].hit(); // вызовем реакцию у самой клетки
        var shipInCoords = getShipInCoords(x, y); // проверим, нет ли корабля в том месте, куда попали
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
                for (var s = 0; s < shipsOnField.length; s++) { // проверим состояние всех кораблей
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
            return TurnResult.HIT;
        } else {                  
            return TurnResult.MISSED;
        }
    }
    
    this.bindClickEvents = function (clickEvent) { // привязываем обработчик события нажатия на клетку всем клеткам
        if (isPlayer) return; // убедимся, что эта функция вызвана не на поле игрока
        
        for (var i = 1; i < gameField.length; i++) {
            for (var j = 1; j < gameField[i].length; j++) {
                gameField[i][j].bindClickEvent(clickEvent);
            }
        }
    }
    
    this.unBindClickEvents = function () { // отвязываем обработчик события нажатия на клетку всем клеткам
        if (isPlayer) return;
        
        for (var i = 1; i < gameField.length; i++) {
            for (var j = 1; j < gameField[i].length; j++) {
                gameField[i][j].unBindClickEvent();
            }
        }
    }
    
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
        
        this.occupy = function () { // помечаем клетку, как занятую и показываем корабль, если действие происходит на поле игрока
            occupationState = CellOccupationType.OCCUPIED;
            if (isPlayer) showShip(this);
        }
        
        this.reserv = function () { // помечаем клетку, как недоступную для размещения на ней новых кораблей
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
        }
        
        this.bindClickEvent = function (clickEvent) { // привязываем обработчик события нажатия к текущей клетке
            if (hitState != CellHitType.NONE || this.cellObject == null) return;
            
            this.cellObject.addClass("game-field-cell-clickable");
            this.cellObject.on("click", { // привязка события к ячейке
                    x: x, // расположение ячейки в таблице
                    y: y
                }, clickEvent);
        }
        
        this.unBindClickEvent = function () { // отвязываем обработчик события нажатия от текущей клетки
            this.cellObject.removeClass("game-field-cell-clickable");
            this.cellObject.off("click");
        }
        
        function showShip (me) { // отображаем корабль на поле
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
    // настройки плагина
    settings = $.extend({
        // размеры игрового поля (в ячейках) по умолчанию
       fieldWidth: 10,
       fieldHeight: 10,
       computerWaitTime: 1000 // пауза между ходами компьютера (в мс)
    }, options );
    
    this.empty(); // очищаем div, в котором будем размещать игру
    
    var gameManager = new GameManager(this, prompt("Здравствуйте! Пожалуйста, введите ваше имя:")); // создаем объект управления игрой, передаем ему jQuert объект div'а и имя игрока, запрошенное в диалоговом окне
    gameManager.startGame(); // запускаем игру
}

}(jQuery));