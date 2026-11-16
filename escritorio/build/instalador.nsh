; Carpeta de datos compartida por todos los usuarios de Windows de la PC
; (C:\ProgramData\TypeLake): el paquete de alumnos y los resultados guardados.
; Se da permiso de escritura a todos los usuarios para que cualquier cuenta pueda guardar.
!macro customInstall
  SetShellVarContext all
  CreateDirectory "$APPDATA\TypeLake"
  nsExec::Exec 'icacls "$APPDATA\TypeLake" /grant *S-1-5-32-545:(OI)(CI)M /T /Q'
!macroend
