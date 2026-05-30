'use strict';

// i18n: lightweight internationalization for Maze Party
// Locale data is embedded to avoid async loading and flash of untranslated content.

var LOCALES = {
  en: {
    // Canvas UI labels
    ko: 'KO',

    // Lobby
    scan_to_join: 'Scan to join',
    waiting_for_players: 'Waiting for players...',
    start_n_players: { one: 'START ({count} player)', other: 'START ({count} players)' },
    start: 'START',

    // Buttons
    start_new_game: 'START NEW GAME',
    play_again: 'Play Again',
    new_game: 'New Game',
    continue_btn: 'Continue',
    reconnect: 'RECONNECT',
    rejoin: 'REJOIN',
    join: 'JOIN',

    // Connection
    reconnecting: 'RECONNECTING',
    disconnected: 'DISCONNECTED',
    connecting: 'CONNECTING...',
    connection_lost: 'Connection lost...',
    attempt_n_of_m: 'Attempt {attempt} of {max}',
    display_reconnecting: 'Display reconnecting...',
    bad_connection: 'Bad Connection',
    report_bad_latency: 'Report bad latency',
    relay_server_status_label: 'Relay server status',

    // Screens
    paused: 'PAUSED',
    room_not_found: 'Room Not Found',
    game_ended: 'Game ended',
    game_full: 'Room is Full',
    game_in_progress: 'Game in progress. Please wait for New Game.',
    waiting_for_host_to_start: 'Waiting for {name} to start the game',
    waiting_for_host_to_continue: 'Waiting for {name} to continue',

    // Results
    n_lines: { one: '{count} line', other: '{count} lines' },
    new_player: 'New player',
    escaped: '🏁 Escaped',
    did_not_escape: 'Did not escape',

    // Misc
    player: 'Player',
    color_choose: 'Choose color {n}',
    color_choose_heading: 'Choose your color',
    color_close: 'Close',
    enter_name: 'Enter name...',
    copied: 'Copied',
    touchpad: 'Touchpad',

    // Credits
    stacked_by: 'Stacked by Tim',

    // Gesture hints
    swipe: 'Swipe',
    gesture_move: 'move',

    // Settings overlay
    settings_title: 'SETTINGS',
    settings_done: 'DONE',
    settings_touch_sounds: 'Touch Sounds',
    settings_haptics: 'Haptics',
    settings_haptics_hint: 'Vibration may not work on all devices',
    settings_haptic_off: 'Off',
    settings_haptic_light: 'Light',
    settings_haptic_medium: 'Med',
    settings_haptic_strong: 'Strong',

    // Display toolbar
    fullscreen: 'Fullscreen',

    // Action buttons without visible text
    pause: 'Pause',
    copy_url: 'Copy URL',

    // Web Share API
  },

  de: {
    ko: 'K.O.', go: 'LOS',
    scan_to_join: 'Scannen',
    waiting_for_players: 'Warte auf Spieler...',
    start_n_players: { one: 'START ({count} Spieler)', other: 'START ({count} Spieler)' },
    start: 'START', start_new_game: 'NEUES SPIEL', close: 'Schließen',
    play_again: 'Nochmal',
    new_game: 'Neues Spiel',
    continue_btn: 'Weiter',
    reconnect: 'NEU VERBINDEN', rejoin: 'ZURÜCK', join: 'BEITRETEN',
    reconnecting: 'VERBINDE NEU...', disconnected: 'GETRENNT',
    connecting: 'VERBINDE...', connection_lost: 'Verbindung verloren...',
    attempt_n_of_m: 'Versuch {attempt} von {max}',
    display_reconnecting: 'Display verbindet sich neu...',
    bad_connection: 'Schlechte Verbindung',
    report_bad_latency: 'Schlechte Latenz melden',
    relay_server_status_label: 'Relay-Server-Status',
    paused: 'PAUSIERT', room_not_found: 'Raum nicht gefunden', game_full: 'Raum ist voll',
    game_ended: 'Spiel beendet',
    game_in_progress: 'Spiel läuft. Warte auf die nächste Runde.',
    waiting_for_host_to_start: 'Warte auf {name}...',
    waiting_for_host_to_continue: 'Warte auf {name}...',
    n_lines: { one: '{count} Zeile', other: '{count} Zeilen' },
    new_player: 'Neuer Spieler',
    escaped: '🏁 Entkommen',
    did_not_escape: 'Nicht entkommen',
    color_choose: 'Farbe {n} wählen',
    color_choose_heading: 'Farbe wählen', color_close: 'Schließen',
    enter_name: 'Name...', copied: 'Kopiert', touchpad: 'Touchpad',
    stacked_by: 'Entwickelt von Tim',
    swipe: 'Wischen', tap: 'Tippen', flick: 'Schnippen',
    gesture_move: 'Bewegen', gesture_rotate: 'Drehen',
    settings_title: 'EINSTELLUNGEN', settings_done: 'FERTIG',
    settings_haptics: 'Vibration', settings_haptics_hint: 'Funktioniert nicht mit jedem Gerät',
    settings_haptic_off: 'Aus', settings_haptic_light: 'Leicht',
    settings_haptic_medium: 'Mittel', settings_haptic_strong: 'Stark',
    fullscreen: 'Vollbild', pause: 'Pause', copy_url: 'URL kopieren',
  },

  fr: {
    ko: 'K.O.', go: 'GO',
    scan_to_join: 'Scanner pour rejoindre',
    waiting_for_players: 'En attente de joueurs...',
    start_n_players: { one: 'LANCER ({count} joueur)', other: 'LANCER ({count} joueurs)' },
    start: 'LANCER', start_new_game: 'NOUVELLE PARTIE', close: 'Fermer',
    play_again: 'Rejouer',
    new_game: 'Nouvelle partie',
    continue_btn: 'Continuer',
    reconnect: 'SE RECONNECTER', rejoin: 'REJOINDRE', join: 'REJOINDRE',
    reconnecting: 'RECONNEXION', disconnected: 'DÉCONNECTÉ',
    connecting: 'CONNEXION...', connection_lost: 'Connexion perdue...',
    attempt_n_of_m: 'Tentative {attempt} sur {max}',
    display_reconnecting: 'Reconnexion de l\'écran...',
    bad_connection: 'Mauvaise connexion',
    report_bad_latency: 'Signaler une mauvaise latence',
    relay_server_status_label: 'État du serveur relais',
    paused: 'EN PAUSE', room_not_found: 'Salle introuvable', game_full: 'Salle pleine',
    game_ended: 'Partie terminée',
    game_in_progress: 'Partie en cours. Attends la prochaine.',
    waiting_for_host_to_start: 'En attente de {name}...',
    waiting_for_host_to_continue: 'En attente de {name}...',
    n_lines: { one: '{count} ligne', other: '{count} lignes' },
    new_player: 'Nouveau joueur',
    escaped: '🏁 Échappé',
    did_not_escape: 'Pas échappé',
    color_choose: 'Choisir la couleur {n}',
    color_choose_heading: 'Choisis ta couleur', color_close: 'Fermer',
    enter_name: 'Entre ton nom...', copied: 'Copié', touchpad: 'Pavé tactile',
    swipe: 'Glisser', tap: 'Appuyer', flick: 'Lancer',
    gesture_move: 'déplacer', gesture_rotate: 'tourner',
    stacked_by: 'Créé par Tim',
    settings_title: 'RÉGLAGES', settings_done: 'OK',
    settings_haptics: 'Vibration', settings_haptics_hint: 'Peut ne pas marcher partout',
    settings_haptic_off: 'Off', settings_haptic_light: 'Léger',
    settings_haptic_medium: 'Moyen', settings_haptic_strong: 'Fort',
    fullscreen: 'Plein écran', pause: 'Pause', copy_url: 'Copier l\'URL',
  },

  pt: {
    ko: 'K.O.', go: 'JÁ!',
    scan_to_join: 'Escaneia para entrar',
    waiting_for_players: 'Aguardando jogadores...',
    start_n_players: { one: 'INICIAR ({count} jogador)', other: 'INICIAR ({count} jogadores)' },
    start: 'INICIAR', start_new_game: 'NOVO JOGO', close: 'Fechar',
    play_again: 'Jogar novamente',
    new_game: 'Novo jogo',
    continue_btn: 'Continuar',
    reconnect: 'RECONECTAR', rejoin: 'VOLTAR', join: 'ENTRAR',
    reconnecting: 'RECONECTANDO', disconnected: 'DESCONECTADO',
    connecting: 'CONECTANDO...', connection_lost: 'Conexão perdida...',
    attempt_n_of_m: 'Tentativa {attempt} de {max}',
    display_reconnecting: 'Tela reconectando...',
    bad_connection: 'Conexão ruim',
    report_bad_latency: 'Reportar latência ruim',
    relay_server_status_label: 'Status do servidor relay',
    paused: 'PAUSADO', room_not_found: 'Sala não encontrada', game_full: 'Sala cheia',
    game_ended: 'Jogo encerrado',
    game_in_progress: 'Jogo em andamento. Espera a próxima.',
    waiting_for_host_to_start: 'Esperando {name}...',
    waiting_for_host_to_continue: 'Esperando {name}...',
    n_lines: { one: '{count} linha', other: '{count} linhas' },
    new_player: 'Novo jogador',
    escaped: '🏁 Escapou',
    did_not_escape: 'Não escapou',
    color_choose: 'Escolher cor {n}',
    color_choose_heading: 'Escolha sua cor', color_close: 'Fechar',
    enter_name: 'Digita o nome...', copied: 'Copiado', touchpad: 'Touchpad',
    stacked_by: 'Criado por Tim',
    swipe: 'Deslizar', tap: 'Tocar', flick: 'Lançar',
    gesture_move: 'mover', gesture_rotate: 'girar',
    settings_title: 'AJUSTES', settings_done: 'PRONTO',
    settings_haptics: 'Vibração', settings_haptics_hint: 'Pode não funcionar em todos os aparelhos',
    settings_haptic_off: 'Off', settings_haptic_light: 'Fraca',
    settings_haptic_medium: 'Média', settings_haptic_strong: 'Forte',
    fullscreen: 'Tela cheia', pause: 'Pausar', copy_url: 'Copiar URL',
  },

  es: {
    ko: 'K.O.', go: '¡YA!',
    scan_to_join: 'Escanea para unirte',
    waiting_for_players: 'Esperando jugadores...',
    start_n_players: { one: 'INICIAR ({count} jugador)', other: 'INICIAR ({count} jugadores)' },
    start: 'INICIAR', start_new_game: 'NUEVA PARTIDA', close: 'Cerrar',
    play_again: 'Jugar de nuevo',
    new_game: 'Nueva partida',
    continue_btn: 'Continuar',
    reconnect: 'RECONECTAR', rejoin: 'VOLVER', join: 'UNIRSE',
    reconnecting: 'RECONECTANDO', disconnected: 'DESCONECTADO',
    connecting: 'CONECTANDO...', connection_lost: 'Conexión perdida...',
    attempt_n_of_m: 'Intento {attempt} de {max}',
    display_reconnecting: 'Pantalla reconectando...',
    bad_connection: 'Mala conexión',
    report_bad_latency: 'Informar mala latencia',
    relay_server_status_label: 'Estado del servidor relay',
    paused: 'PAUSA', room_not_found: 'Sala no encontrada', game_full: 'Sala llena',
    game_ended: 'Partida finalizada',
    game_in_progress: 'Partida en curso. Espera la próxima.',
    waiting_for_host_to_start: 'Esperando a {name}...',
    waiting_for_host_to_continue: 'Esperando a {name}...',
    n_lines: { one: '{count} línea', other: '{count} líneas' },
    new_player: 'Nuevo jugador',
    escaped: '🏁 Escapó',
    did_not_escape: 'No escapó',
    color_choose: 'Elegir color {n}',
    color_choose_heading: 'Elige tu color', color_close: 'Cerrar',
    enter_name: 'Escribe tu nombre...', copied: 'Copiado', touchpad: 'Touchpad',
    swipe: 'Deslizar', tap: 'Tocar', flick: 'Lanzar',
    gesture_move: 'mover', gesture_rotate: 'girar',
    stacked_by: 'Creado por Tim',
    settings_title: 'AJUSTES', settings_done: 'LISTO',
    settings_haptics: 'Vibración', settings_haptics_hint: 'Puede no funcionar en todos los dispositivos',
    settings_haptic_off: 'Off', settings_haptic_light: 'Suave',
    settings_haptic_medium: 'Media', settings_haptic_strong: 'Fuerte',
    fullscreen: 'Pantalla completa', pause: 'Pausa', copy_url: 'Copiar URL',
  },

  zh: {
    ko: 'K.O.', go: '开始',
    scan_to_join: '扫码加入',
    waiting_for_players: '等待玩家加入...',
    start_n_players: { other: '开始 ({count} 位玩家)' },
    start: '开始', start_new_game: '开始新游戏', close: '关闭',
    play_again: '再来一局',
    new_game: '新游戏',
    continue_btn: '继续',
    reconnect: '重新连接', rejoin: '重新加入', join: '加入',
    reconnecting: '正在重连', disconnected: '已断开连接',
    connecting: '正在连接...', connection_lost: '连接已断开...',
    attempt_n_of_m: '第 {attempt} 次尝试，共 {max} 次',
    display_reconnecting: '显示屏正在重连...',
    bad_connection: '连接不佳',
    report_bad_latency: '报告高延迟',
    relay_server_status_label: '中继服务器状态',
    paused: '已暂停', room_not_found: '房间未找到', game_full: '房间已满',
    game_ended: '游戏已结束',
    game_in_progress: '游戏中，等下一局',
    waiting_for_host_to_start: '等待 {name} 开始游戏',
    waiting_for_host_to_continue: '等待 {name} 继续',
    n_lines: { other: '{count} 行' },
    new_player: '新玩家',
    escaped: '🏁 逃脱',
    did_not_escape: '未逃脱',
    color_choose: '选择颜色 {n}',
    color_choose_heading: '选择你的颜色', color_close: '关闭',
    enter_name: '输入名字...', copied: '已复制', touchpad: '触控板',
    swipe: '滑动', tap: '点按', flick: '快划',
    gesture_move: '移动', gesture_rotate: '旋转',
    stacked_by: '开发：Tim',
    settings_title: '设置', settings_done: '完成',
    settings_haptics: '振动', settings_haptics_hint: '部分设备可能不支持',
    settings_haptic_off: '关', settings_haptic_light: '弱',
    settings_haptic_medium: '中', settings_haptic_strong: '强',
    fullscreen: '全屏', pause: '暂停', copy_url: '复制 URL',
  },

  ja: {
    ko: 'K.O.', go: 'GO',
    scan_to_join: 'スキャンして参加',
    waiting_for_players: 'プレイヤー待ってる...',
    start_n_players: { other: 'スタート ({count}人)' },
    start: 'スタート', start_new_game: '新しいゲームを開始', close: '閉じる',
    play_again: 'もう一度',
    new_game: '新しいゲーム',
    continue_btn: '続ける',
    reconnect: '再接続', rejoin: '再参加', join: '参加',
    reconnecting: '再接続中...', disconnected: '切断された',
    connecting: '接続中...', connection_lost: '接続が切れた...',
    attempt_n_of_m: '再試行 {attempt}/{max}',
    display_reconnecting: 'ディスプレイ再接続中...',
    bad_connection: '接続不良',
    report_bad_latency: '遅延を報告',
    relay_server_status_label: 'リレーサーバーの状態',
    paused: '一時停止', room_not_found: 'ルームが見つからない', game_full: 'ルームが満員',
    game_ended: 'ゲーム終了',
    game_in_progress: 'ゲーム中。次のゲームまで待ってね',
    waiting_for_host_to_start: '{name}が始めるのを待ってるよ',
    waiting_for_host_to_continue: '{name}が続けるのを待ってるよ',
    n_lines: { other: '{count}ライン' },
    new_player: '新しいプレイヤー',
    escaped: '🏁 脱出',
    did_not_escape: '脱出できず',
    color_choose: '色 {n} を選ぶ',
    color_choose_heading: '色を選んでください', color_close: '閉じる',
    enter_name: '名前を入力...', copied: 'コピー完了', touchpad: 'タッチパッド',
    swipe: 'スワイプ', tap: 'タップ', flick: 'フリック',
    gesture_move: '移動', gesture_rotate: '回転',
    stacked_by: '開発：Tim',
    settings_title: '設定', settings_done: 'OK',
    settings_haptics: '振動', settings_haptics_hint: '端末によっては効かないかも',
    settings_haptic_off: 'オフ', settings_haptic_light: '弱',
    settings_haptic_medium: '中', settings_haptic_strong: '強',
    fullscreen: '全画面', pause: '一時停止', copy_url: 'URLをコピー',
  },

  ko: {
    ko: 'K.O.', go: 'GO',
    scan_to_join: '스캔하여 참가',
    waiting_for_players: '플레이어를 기다리는 중...',
    start_n_players: { other: '시작 ({count}명)' },
    start: '시작', start_new_game: '새 게임 시작', close: '닫기',
    play_again: '다시 하기',
    new_game: '새 게임',
    continue_btn: '계속',
    reconnect: '재연결', rejoin: '재참가', join: '참가',
    reconnecting: '재연결 중', disconnected: '연결 끊김',
    connecting: '연결 중...', connection_lost: '연결 끊겼어...',
    attempt_n_of_m: '시도 {attempt}/{max}',
    display_reconnecting: '디스플레이 재연결 중...',
    bad_connection: '연결 불량',
    report_bad_latency: '지연 신고',
    relay_server_status_label: '릴레이 서버 상태',
    paused: '일시정지', room_not_found: '방을 찾을 수 없어', game_full: '방이 가득 찼어',
    game_ended: '게임 끝',
    game_in_progress: '게임 중. 새 게임 기다려',
    waiting_for_host_to_start: '{name} 기다리는 중...',
    waiting_for_host_to_continue: '{name} 기다리는 중...',
    n_lines: { other: '{count}줄' },
    new_player: '새 플레이어',
    escaped: '🏁 탈출',
    did_not_escape: '탈출 실패',
    color_choose: '색 {n} 선택',
    color_choose_heading: '색상을 선택하세요', color_close: '닫기',
    enter_name: '이름 입력...', copied: '복사됨', touchpad: '터치패드',
    swipe: '스와이프', tap: '탭', flick: '플릭',
    gesture_move: '이동', gesture_rotate: '회전',
    stacked_by: '개발: Tim',
    settings_title: '설정', settings_done: '완료',
    settings_haptics: '진동', settings_haptics_hint: '일부 기기에서는 안 될 수 있어',
    settings_haptic_off: '끔', settings_haptic_light: '약',
    settings_haptic_medium: '중', settings_haptic_strong: '강',
    fullscreen: '전체화면', pause: '일시정지', copy_url: 'URL 복사',
  },

  ru: {
    ko: 'K.O.', go: 'СТАРТ',
    scan_to_join: 'Сканируй и заходи',
    waiting_for_players: 'Ждём игроков...',
    start_n_players: {
      one: 'СТАРТ ({count} игрок)', few: 'СТАРТ ({count} игрока)',
      many: 'СТАРТ ({count} игроков)', other: 'СТАРТ ({count} игроков)'
    },
    start: 'СТАРТ', start_new_game: 'НОВАЯ ИГРА', close: 'Закрыть',
    play_again: 'Играть снова',
    new_game: 'Новая игра',
    continue_btn: 'Продолжить',
    reconnect: 'ПЕРЕПОДКЛЮЧИТЬСЯ', rejoin: 'ВЕРНУТЬСЯ', join: 'ВОЙТИ',
    reconnecting: 'ПЕРЕПОДКЛЮЧЕНИЕ', disconnected: 'ОТКЛЮЧЕНО',
    connecting: 'ПОДКЛЮЧЕНИЕ...', connection_lost: 'Соединение потеряно...',
    attempt_n_of_m: 'Попытка {attempt} из {max}',
    display_reconnecting: 'Дисплей переподключается...',
    bad_connection: 'Плохое соединение',
    report_bad_latency: 'Сообщить о задержке',
    relay_server_status_label: 'Состояние сервера ретрансляции',
    paused: 'ПАУЗА', room_not_found: 'Комната не найдена', game_full: 'Комната заполнена',
    game_ended: 'Игра окончена',
    game_in_progress: 'Игра идёт. Жди новую.',
    waiting_for_host_to_start: 'Ждём {name}...',
    waiting_for_host_to_continue: 'Ждём {name}...',
    n_lines: {
      one: '{count} линия', few: '{count} линии',
      many: '{count} линий', other: '{count} линий'
    },
    new_player: 'Новый игрок',
    escaped: '🏁 Сбежал',
    did_not_escape: 'Не сбежал',
    color_choose: 'Выбрать цвет {n}',
    color_choose_heading: 'Выберите цвет', color_close: 'Закрыть',
    enter_name: 'Введи имя...', copied: 'Скопировано', touchpad: 'Тачпад',
    swipe: 'Свайп', tap: 'Нажатие', flick: 'Смахивание',
    gesture_move: 'двигать', gesture_rotate: 'вращать',
    stacked_by: 'Разработка: Tim',
    settings_title: 'НАСТРОЙКИ', settings_done: 'ГОТОВО',
    settings_haptics: 'Вибрация', settings_haptics_hint: 'Работает не на всех устройствах',
    settings_haptic_off: 'Выкл', settings_haptic_light: 'Слабо',
    settings_haptic_medium: 'Средне', settings_haptic_strong: 'Сильно',
    fullscreen: 'Полный экран', pause: 'Пауза', copy_url: 'Скопировать URL',
  },

  it: {
    ko: 'K.O.', go: 'VIA!',
    scan_to_join: 'Scansiona per unirti',
    waiting_for_players: 'In attesa di giocatori...',
    start_n_players: { one: 'AVVIA ({count} giocatore)', other: 'AVVIA ({count} giocatori)' },
    start: 'AVVIA', start_new_game: 'NUOVA PARTITA', close: 'Chiudi',
    play_again: 'Gioca ancora',
    new_game: 'Nuova partita',
    continue_btn: 'Continua',
    reconnect: 'RICONNETTI', rejoin: 'RIENTRA', join: 'UNISCITI',
    reconnecting: 'RICONNESSIONE', disconnected: 'DISCONNESSO',
    connecting: 'CONNESSIONE...', connection_lost: 'Connessione persa...',
    attempt_n_of_m: 'Tentativo {attempt} di {max}',
    display_reconnecting: 'Display in riconnessione...',
    bad_connection: 'Connessione scarsa',
    report_bad_latency: 'Segnala alta latenza',
    relay_server_status_label: 'Stato del server relay',
    paused: 'IN PAUSA', room_not_found: 'Stanza non trovata', game_full: 'Stanza piena',
    game_ended: 'Partita terminata',
    game_in_progress: 'Partita in corso. Aspetta la prossima.',
    waiting_for_host_to_start: 'In attesa di {name}...',
    waiting_for_host_to_continue: 'In attesa di {name}...',
    n_lines: { one: '{count} linea', other: '{count} linee' },
    new_player: 'Nuovo giocatore',
    escaped: '🏁 Fuggito',
    did_not_escape: 'Non fuggito',
    color_choose: 'Scegli il colore {n}',
    color_choose_heading: 'Scegli il tuo colore', color_close: 'Chiudi',
    enter_name: 'Scrivi il nome...', copied: 'Copiato', touchpad: 'Touchpad',
    stacked_by: 'Creato da Tim',
    swipe: 'Scorrere', tap: 'Toccare', flick: 'Lanciare',
    gesture_move: 'muovere', gesture_rotate: 'ruotare',
    settings_title: 'IMPOSTAZIONI', settings_done: 'OK',
    settings_haptics: 'Vibrazione', settings_haptics_hint: 'Non funziona su tutti i dispositivi',
    settings_haptic_off: 'Off', settings_haptic_light: 'Lieve',
    settings_haptic_medium: 'Media', settings_haptic_strong: 'Forte',
    fullscreen: 'Schermo intero', pause: 'Pausa', copy_url: 'Copia URL',
  },

  tr: {
    ko: 'K.O.', go: 'BAŞLA!',
    scan_to_join: 'Katılmak için tara',
    waiting_for_players: 'Oyuncular bekleniyor...',
    start_n_players: { one: 'BAŞLAT ({count} oyuncu)', other: 'BAŞLAT ({count} oyuncu)' },
    start: 'BAŞLAT', start_new_game: 'YENİ OYUN BAŞLAT', close: 'Kapat',
    play_again: 'Tekrar oyna',
    new_game: 'Yeni oyun',
    continue_btn: 'Devam',
    reconnect: 'YENİDEN BAĞLAN', rejoin: 'TEKRAR KATIL', join: 'KATIL',
    reconnecting: 'YENİDEN BAĞLANIYOR', disconnected: 'BAĞLANTI KESİLDİ',
    connecting: 'BAĞLANIYOR...', connection_lost: 'Bağlantı kesildi...',
    attempt_n_of_m: 'Deneme {attempt}/{max}',
    display_reconnecting: 'Ekran yeniden bağlanıyor...',
    bad_connection: 'Kötü bağlantı',
    report_bad_latency: 'Yüksek gecikme bildir',
    relay_server_status_label: 'Aktarıcı sunucu durumu',
    paused: 'DURAKLATILDI', room_not_found: 'Oda bulunamadı', game_full: 'Oda dolu',
    game_ended: 'Oyun sona erdi',
    game_in_progress: 'Oyun devam ediyor. Yeni oyunu bekle.',
    waiting_for_host_to_start: '{name} oyunu başlatana kadar bekle',
    waiting_for_host_to_continue: '{name} devam edene kadar bekle',
    n_lines: { one: '{count} satır', other: '{count} satır' },
    new_player: 'Yeni oyuncu',
    escaped: '🏁 Kaçtı',
    did_not_escape: 'Kaçamadı',
    color_choose: 'Renk {n} seç',
    color_choose_heading: 'Rengini seç', color_close: 'Kapat',
    enter_name: 'İsim gir...', copied: 'Kopyalandı', touchpad: 'Touchpad',
    stacked_by: 'Yapımcı: Tim',
    swipe: 'Kaydır', tap: 'Dokun', flick: 'Fırlat',
    gesture_move: 'hareket ettir', gesture_rotate: 'döndür',
    settings_title: 'AYARLAR', settings_done: 'TAMAM',
    settings_haptics: 'Titreşim', settings_haptics_hint: 'Her cihazda çalışmayabilir',
    settings_haptic_off: 'Kapalı', settings_haptic_light: 'Hafif',
    settings_haptic_medium: 'Orta', settings_haptic_strong: 'Güçlü',
    fullscreen: 'Tam ekran', pause: 'Duraklat', copy_url: 'URL\'yi kopyala',
  }
};

// --- Internal state ---
var _locale = 'en';
var _strings = LOCALES.en;
var _pluralRules = null;

function _initRules() {
  if (typeof Intl !== 'undefined' && Intl.PluralRules) {
    try {
      _pluralRules = new Intl.PluralRules(_locale);
    } catch (e) {
      _pluralRules = null;
    }
  }
}

/**
 * Set the active locale. Falls back to 'en' if the locale is unknown.
 * @param {string} lang - Language code (e.g. 'en', 'de', 'fr-CA')
 */
function setLocale(lang) {
  var code = (lang || 'en').toLowerCase().split('-')[0];
  if (!LOCALES[code]) code = 'en';
  _locale = code;
  _strings = LOCALES[code];
  _initRules();
}

/** @returns {string} Current locale code */
function getLocale() { return _locale; }

/**
 * Look up a translated string by key, with optional interpolation and plural selection.
 *
 * @param {string} key - Translation key
 * @param {Object} [params] - Interpolation params. If `params.count` is set and the
 *   value is an object with plural categories, the correct form is selected via Intl.PluralRules.
 * @returns {string} Translated string, or the key itself if not found
 */
function t(key, params) {
  var val = _strings[key];
  if (val === undefined) val = LOCALES.en[key];
  if (val === undefined) return key;

  // Plural selection: value is { one: '...', other: '...' } and params.count is provided
  if (typeof val === 'object') {
    var cat = (params && params.count !== undefined && _pluralRules)
      ? _pluralRules.select(params.count)
      : (params && params.count === 1 ? 'one' : 'other');
    val = val[cat] || val.other || '';
  }

  // Parameter interpolation: {paramName} → params.paramName
  if (typeof val === 'string' && params) {
    return val.replace(/\{(\w+)\}/g, function(match, k) {
      return params[k] !== undefined ? params[k] : match;
    });
  }

  return val;
}

/**
 * Translate all static HTML elements with data-i18n, data-i18n-placeholder,
 * or data-i18n-title attributes.
 *
 * SECURITY: data-i18n-html renders the locale string as HTML via innerHTML.
 * It is ONLY safe because locale strings are hardcoded developer content in
 * this file. Do NOT pass user input, server-provided strings, or any
 * untrusted content through a data-i18n-html key. Doing so is XSS. Prefer
 * data-i18n (uses textContent) for any string that could include external
 * data, and keep the set of data-i18n-html keys minimal.
 */
function translatePage() {
  if (typeof document === 'undefined') return;

  var els = document.querySelectorAll('[data-i18n]');
  for (var i = 0; i < els.length; i++) {
    els[i].textContent = t(els[i].getAttribute('data-i18n'));
  }

  var phs = document.querySelectorAll('[data-i18n-placeholder]');
  for (var j = 0; j < phs.length; j++) {
    phs[j].placeholder = t(phs[j].getAttribute('data-i18n-placeholder'));
  }

  var arias = document.querySelectorAll('[data-i18n-aria-label]');
  for (var a = 0; a < arias.length; a++) {
    arias[a].setAttribute('aria-label', t(arias[a].getAttribute('data-i18n-aria-label')));
  }

  // data-i18n-html renders the locale string as HTML. Only use for trusted
  // locale content. Never pass user input through this attribute.
  var htmlEls = document.querySelectorAll('[data-i18n-html]');
  for (var h = 0; h < htmlEls.length; h++) {
    htmlEls[h].innerHTML = t(htmlEls[h].getAttribute('data-i18n-html'));
  }

  // data-i18n-title: sets textContent on the <title> element, sets the
  // `title` attribute (hover tooltip) on any other element.
  var titleEls = document.querySelectorAll('[data-i18n-title]');
  for (var k = 0; k < titleEls.length; k++) {
    var titleEl = titleEls[k];
    var translated = t(titleEl.getAttribute('data-i18n-title'));
    if (titleEl.tagName === 'TITLE') {
      titleEl.textContent = translated;
    } else {
      titleEl.setAttribute('title', translated);
    }
  }

  document.documentElement.lang = _locale;
}

/**
 * Auto-detect locale from URL param → navigator.language → 'en'.
 */
function detectLocale() {
  var lang = null;

  // 1. URL parameter ?lang=xx
  if (typeof URLSearchParams !== 'undefined' && typeof location !== 'undefined') {
    try { lang = new URLSearchParams(location.search).get('lang'); } catch (e) { /* ignore */ }
  }

  // 2. Browser language
  if (!lang && typeof navigator !== 'undefined' && navigator.language) {
    lang = navigator.language;
  }

  setLocale(lang || 'en');
}

// Auto-detect locale on load
detectLocale();

// Translate static HTML elements (scripts are at end of <body>, so DOM is ready)
translatePage();

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { t: t, setLocale: setLocale, getLocale: getLocale, translatePage: translatePage, detectLocale: detectLocale, LOCALES: LOCALES };
}
