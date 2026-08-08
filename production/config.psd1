@{
    # "auto" utiliza el nombre de la computadora Windows y mantiene la misma URL
    # aunque cambie la IP. Para usar http://crm-idesem:8000, cambia este valor a
    # "crm-idesem" y asigna tambien CRM-IDESEM como nombre del equipo en Windows.
    HostName = "auto"

    # Puerto unico para frontend, API, imagenes y panel administrativo.
    Port = 8000

    # Abre el CRM en el navegador de la computadora principal al iniciar.
    OpenBrowser = $true
}
