# Cognitive_Commit

勉強記録用のアプリ

## インストール

- クローン

```bash
git clone https://github.com/Ichiyou1922/Cognitive_Commit.git
```

SSHキーを使用している場合は

```bash
git clone git@github.com:Ichiyou1922/Cognitive_Commit.git
```

- インストール

```bash
cd Cognitive_Commit/my-study-app
npm install
npm run build:[OS] // windowsなら[OS]=win, macなら[OS]=mac, linuxなら[OS]=linux
```

## 起動

`my-study-app`の下に`dist`というディレクトリが生成されて，その下に実行ファイルがあるので実行．

## 使用方法

- 初回起動時に勉強記録を保存するディレクトリを選択する．

- ローカルの保存ディレクトリとGitをリンクさせたい場合は，空のリポジトリを作成し，HTTPSかSSH（SSHはキーを生成していれば）をコピーし張る．

- 入力が終わるとメイン画面に移行する．

- What will you learn? の入力スペースに，勉強内容（なるべく詳しく何を理解したいか）を入力し，活動時間をその下のTimeに入力->COMMIT

- Timerが開始する（ABORTを押すと中断される．データは残らない）
- Timer終了と同時に画面が移行．
- Acquisitionの欄には理解した内容を
- Debtには理解できなかった，不明瞭だった内容を
- Next ActionにはDebtの改善方法や次にやりたいことなどを書く
- SAVE LOGを押すとファイルが保存される（Gitと連携している人はそちらにも反映される）
- 終わり．

## 設定

- ファイル保存場所を変えるとか，Gitとのリンク先変えるとかなら設定をクリック->初回起動時と同じ画面に移行する
