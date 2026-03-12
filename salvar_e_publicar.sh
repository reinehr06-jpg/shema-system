#!/bin/bash

# Script de Deploy Automático para o projeto SHEMA
# Este arquivo vai adicionar tudo que você modificou no painel e enviar para o GitHub
# Quando chegar no GitHub, o servidor AWS pegará as mudanças sozinho.

echo "========================================"
echo "🚀 Iniciando Deploy do Projeto Shema"
echo "========================================"

# Verifica se o diretório atual é um repositório git
if [ ! -d ".git" ]; then
    echo "ERRO: Este diretório ainda não foi configurado com o GitHub."
    echo "Siga as instruções dadas pela Inteligência Artificial antes de rodar este script."
    exit 1
fi

echo "1. Coletando novas atualizações..."
git add .

# Pega a data e hora atual para o nome do commit
COMMIT_MSG="Deploy automático - $(date '+%d/%m/%Y %H:%M:%S')"

echo "2. Salvando a versão: $COMMIT_MSG"
git commit -m "$COMMIT_MSG"

echo "3. Enviando código para a Nuvem / AWS..."
# Empurra para a branch principal (main)
git push origin main

if [ $? -eq 0 ]; then
    echo "========================================"
    echo "✅ DEPLOY ENVIADO COM SUCESSO!"
    echo "O Github Actions já está atualizando sua AWS em segundo plano."
    echo "========================================"
else
    echo "========================================"
    echo "❌ ERRO AO ENVIAR PARA A NUVEM."
    echo "Verifique sua conexão ou se há conflitos no Git."
    echo "========================================"
fi
