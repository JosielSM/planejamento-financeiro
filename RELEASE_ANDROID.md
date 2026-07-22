# Publicação Android

O aplicativo usa `versionCode 5` e `versionName 1.4.0`. O APK disponível no site é compilado para testes diretos. Uma publicação pública deve usar uma chave privada definitiva e um Android App Bundle.

## Preparação única

1. Crie e guarde uma chave JKS fora deste repositório.
2. Use `.env.release.example` como referência e configure as quatro variáveis em um cofre de segredos.
3. Cadastre no Firebase o aplicativo `com.planejamentofinanceiro.app`.
4. Registre os SHA-1 e SHA-256 da chave de release e da assinatura da Play Store.
5. Coloque o `google-services.json` atualizado em `android/app/`. O arquivo é ignorado pelo Git.

## Release reproduzível

Execute `npm run android:release`. O comando bloqueia a publicação sem credenciais, executa testes, sincroniza o Capacitor, gera APK e AAB assinados, copia o APK para `downloads/` e grava o SHA-256 em `downloads/release.json`.

O AAB fica em `android/app/build/outputs/bundle/release/`. Nunca publique a chave, senha ou JKS no GitHub.

## Validação obrigatória

Antes de distribuir, instale em aparelho real, valide e-mail/senha e Google, altere dados offline, feche e reabra, reconecte e confira os dados no Neon. Confira exclusão da conta, política de privacidade, ícones e relatórios.
