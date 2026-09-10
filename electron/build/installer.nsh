; CINF 安装器自定义：强制当前用户、跳过安装模式页，并隐藏安装/卸载详情面板。
; electron-builder 通过 nsis.include 引入本文件。

!macro customHeader
  ShowInstDetails hide
  ShowUninstDetails hide
!macroend

!macro customInstallMode
  ; 与 allowElevation: false / perMachine: false 配合：只装当前用户，避免 UAC 重启导致许可证页出现两次
  StrCpy $isForceCurrentInstall "1"
!macroend
