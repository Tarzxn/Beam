; Beam per-user Windows installer. Build with NSIS 3.x, with /DAPPDIR and /DOUTFILE.
Unicode True
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!ifndef APPDIR
 !error "Pass /DAPPDIR=path to the packaged Beam folder"
!endif
!ifndef OUTFILE
 !define OUTFILE "Beam-Setup-0.7.0.exe"
!endif
!ifndef WEBVIEWSETUP
 !error "Pass /DWEBVIEWSETUP=path to MicrosoftEdgeWebview2Setup.exe"
!endif
Name "Beam"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\Beam"
InstallDirRegKey HKCU "Software\Beam" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID zlib
BrandingText "Beam 0.7.0"
VIProductVersion "0.7.0.0"
VIAddVersionKey /LANG=1033 "ProductName" "Beam"
VIAddVersionKey /LANG=1033 "FileDescription" "Beam Desktop Setup"
VIAddVersionKey /LANG=1033 "FileVersion" "0.7.0"
VIAddVersionKey /LANG=1033 "LegalCopyright" "MIT licensed · Velaris contributors"
!define MUI_ABORTWARNING
!define MUI_ICON "desktop_static\beam.ico"
!define MUI_UNICON "desktop_static\beam.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\Beam.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Beam"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"
Var VerifyMode

Function .onInit
 ${IfNot} ${RunningX64}
  MessageBox MB_ICONSTOP "Beam requires 64-bit Windows 10 or later."
  Abort
 ${EndIf}
 SetShellVarContext current
 StrCpy $VerifyMode "0"
 ${GetParameters} $R0
 ClearErrors
 ${GetOptions} $R0 "/VERIFY" $R1
 ${IfNot} ${Errors}
  StrCpy $VerifyMode "1"
 ${EndIf}
FunctionEnd

Section "Beam desktop (required)" SEC_MAIN
 SectionIn RO
 SetOutPath "$INSTDIR"
 File "${APPDIR}\Beam.exe"
 File "${APPDIR}\README.md"
 File "${APPDIR}\LICENSE"
 File "${APPDIR}\DESKTOP_VALIDATION.md"
 File "${APPDIR}\GOOGLE_SETUP.md"
 File /r "${APPDIR}\_internal"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 ${If} $VerifyMode == "0"
  ; Microsoft's documented WebView2 runtime key, checked in both install scopes.
  SetRegView 32
  ReadRegStr $R0 HKLM "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ReadRegStr $R1 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ${If} $R0 == "0.0.0.0"
   StrCpy $R0 ""
  ${EndIf}
  ${If} $R1 == "0.0.0.0"
   StrCpy $R1 ""
  ${EndIf}
  ${If} $R0 == ""
  ${AndIf} $R1 == ""
   SetOutPath "$PLUGINSDIR"
   File "${WEBVIEWSETUP}"
   DetailPrint "Installing the Microsoft WebView2 Runtime (internet connection required)…"
   ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $R2
   ${If} $R2 != "0"
    MessageBox MB_ICONEXCLAMATION "Microsoft WebView2 could not finish installing. Install the WebView2 Runtime from Microsoft before launching Beam. Beam itself has been installed."
   ${EndIf}
   SetOutPath "$INSTDIR"
  ${EndIf}
  SetRegView 64
  WriteRegStr HKCU "Software\Beam" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam" "DisplayName" "Beam"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam" "DisplayVersion" "0.7.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam" "Publisher" "Beam Project"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam" "DisplayIcon" "$INSTDIR\Beam.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam" "QuietUninstallString" '$\"$INSTDIR\Uninstall.exe$\" /S'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam" "NoRepair" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam" "EstimatedSize" 299743
  CreateDirectory "$SMPROGRAMS\Beam"
  CreateShortcut "$SMPROGRAMS\Beam\Beam.lnk" "$INSTDIR\Beam.exe" "" "$INSTDIR\Beam.exe"
  CreateShortcut "$SMPROGRAMS\Beam\Uninstall Beam.lnk" "$INSTDIR\Uninstall.exe"
 ${Else}
  FileOpen $R0 "$INSTDIR\verification-install.txt" w
  FileWrite $R0 "Isolated payload check: registration and shortcuts intentionally skipped.$\r$\n"
  FileClose $R0
 ${EndIf}
SectionEnd

Section /o "Desktop shortcut" SEC_DESKTOP
 ${If} $VerifyMode == "0"
  CreateShortcut "$DESKTOP\Beam.lnk" "$INSTDIR\Beam.exe" "" "$INSTDIR\Beam.exe"
 ${EndIf}
SectionEnd

Function un.onInit
 SetShellVarContext current
 ${If} ${FileExists} "$INSTDIR\verification-install.txt"
  StrCpy $VerifyMode "1"
 ${Else}
  StrCpy $VerifyMode "0"
 ${EndIf}
FunctionEnd

Section "Uninstall"
 ClearErrors
 Delete "$INSTDIR\Beam.exe"
 ${If} ${Errors}
  MessageBox MB_ICONEXCLAMATION "Close Beam, then run the uninstaller again."
  Abort
 ${EndIf}
 ; Remove only installed payload. User projects and %LOCALAPPDATA%\Beam are preserved.
 RMDir /r "$INSTDIR\_internal"
 Delete "$INSTDIR\README.md"
 Delete "$INSTDIR\LICENSE"
 Delete "$INSTDIR\DESKTOP_VALIDATION.md"
 Delete "$INSTDIR\GOOGLE_SETUP.md"
 Delete "$INSTDIR\GITHUB_SETUP.md"
 Delete "$INSTDIR\verification-install.txt"
 Delete "$INSTDIR\Uninstall.exe"
 ${If} $VerifyMode == "0"
  Delete "$DESKTOP\Beam.lnk"
  Delete "$SMPROGRAMS\Beam\Beam.lnk"
  Delete "$SMPROGRAMS\Beam\Uninstall Beam.lnk"
  RMDir "$SMPROGRAMS\Beam"
  SetRegView 64
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Beam"
  DeleteRegKey HKCU "Software\Beam"
 ${EndIf}
 RMDir "$INSTDIR"
SectionEnd
