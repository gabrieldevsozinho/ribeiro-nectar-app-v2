/**
 * Página mínima que testa uma chave do Google Maps dentro de um iframe.
 *
 * A chave chega por postMessage (nunca pela URL), vinda da tela de configuração
 * na mesma origem. O teste roda no navegador porque a chave da empresa fica
 * restrita ao domínio do sistema: o Google só a aceita vinda de uma página dele.
 * Um iframe novo a cada teste permite testar outra chave sem recarregar a tela.
 */
export const HTML_TESTE_GOOGLE_MAPS = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Teste do Google Maps</title></head>
<body style="margin:0">
<div id="mapa" style="width:240px;height:160px"></div>
<script>
(function () {
  var origem = location.origin;
  var erros = [];
  var enviado = false;
  var CODIGOS = ["ApiNotActivatedMapError", "BillingNotEnabledMapError", "RefererNotAllowedMapError",
    "InvalidKeyMapError", "MissingKeyMapError", "ExpiredKeyMapError", "ApiTargetBlockedMapError",
    "DeletedApiProjectMapError", "ProjectDeniedMapError"];

  function detalhe() { return erros.join(" | ").slice(0, 300); }
  function enviar(resultado) {
    if (enviado) return;
    enviado = true;
    parent.postMessage(Object.assign({ tipo: "resultado-teste-maps" }, resultado), origem);
  }
  function codigoDosErros() {
    var texto = erros.join(" ");
    for (var i = 0; i < CODIGOS.length; i++) if (texto.indexOf(CODIGOS[i]) >= 0) return CODIGOS[i];
    return "FalhaAutenticacao";
  }

  // O Google avisa erros de chave pelo console e por gm_authFailure.
  var consoleErro = console.error;
  console.error = function () {
    try { erros.push(Array.prototype.map.call(arguments, String).join(" ")); } catch (e) {}
    return consoleErro.apply(console, arguments);
  };
  window.gm_authFailure = function () {
    setTimeout(function () { enviar({ ok: false, codigo: codigoDosErros(), detalhe: detalhe() }); }, 300);
  };

  window.__mapsCarregado = async function () {
    try {
      var bibliotecaMapa = await google.maps.importLibrary("maps");
      new bibliotecaMapa.Map(document.getElementById("mapa"), { center: { lat: -21.17, lng: -47.81 }, zoom: 12 });
      var geocodificacao = await google.maps.importLibrary("geocoding");
      new geocodificacao.Geocoder().geocode({ address: "Avenida Paulista, 1000, São Paulo, SP" }, function (_, status) {
        // Dá tempo para o gm_authFailure do mapa chegar antes do veredito.
        setTimeout(function () {
          if (status === "OK") enviar({ ok: true });
          else enviar({ ok: false, codigo: "Geocoding_" + status, detalhe: detalhe() });
        }, 1500);
      });
    } catch (e) {
      enviar({ ok: false, codigo: codigoDosErros(), detalhe: String(e).slice(0, 300) });
    }
  };

  window.addEventListener("message", function (evento) {
    if (evento.origin !== origem || !evento.data || evento.data.tipo !== "testar-chave-maps") return;
    var script = document.createElement("script");
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(String(evento.data.chave || "")) +
      "&callback=__mapsCarregado&loading=async&v=weekly&language=pt-BR&region=BR";
    script.onerror = function () { enviar({ ok: false, codigo: "SemConexao" }); };
    document.head.appendChild(script);
    setTimeout(function () { enviar({ ok: false, codigo: "TempoEsgotado", detalhe: detalhe() }); }, 20000);
  });

  parent.postMessage({ tipo: "testador-maps-pronto" }, origem);
})();
</script>
</body>
</html>`;
