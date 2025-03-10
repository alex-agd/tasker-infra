# Тесты производительности для Tasker

В этом каталоге содержатся скрипты и конфигурации для тестирования производительности приложения Tasker.

## Содержимое

- `load-test.js` - Основной сценарий нагрузочного тестирования на K6
- `test-deployment.yaml` - Конфигурация тестового окружения в Kubernetes

## Конфигурация внешнего балансировщика

Проект настроен для работы с внешним Nginx балансировщиком, который маршрутизирует трафик по следующим правилам:

- Для доменов вида `*.argocd.k8s-[ЧИСЛО].sa` -> `http://192.168.208.[ЧИСЛО]:30007`
- Для доменов вида `*.k8s-[ЧИСЛО].sa` -> `http://192.168.208.[ЧИСЛО]:30001`
- Для доменов вида `*.k3s-[ЧИСЛО].sa` -> `http://192.168.203.[ЧИСЛО]:30001`

Поэтому для тестирования мы:

1. Используем NodePort с фиксированным портом 30001 вместо LoadBalancer
2. Используем доменное имя вида `tasker-test.k8s-5.sa` для доступа к приложению
3. Для CI/CD используем port-forwarding и локальное имя хоста

## Запуск тестов локально

Для локального запуска тестов производительности необходимо:

1. Установить K6:

   ```bash
   # Linux
   sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6

   # Windows (через Chocolatey)
   choco install k6

   # macOS
   brew install k6
   ```

2. Запустить тестовое окружение:

   ```bash
   # Создать тестовое пространство имен
   kubectl create namespace tasker-test

   # Развернуть тестовое приложение
   kubectl apply -f test-deployment.yaml

   # Дождаться запуска
   kubectl wait --for=condition=available --timeout=300s deployment/tasker-app-test -n tasker-test
   ```

3. Запустить тесты:

   ```bash
   # Способ 1: Напрямую через NodePort (требует доступа к узлу Kubernetes)
   NODE_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
   k6 run -e TASKER_URL=http://$NODE_IP:30001 load-test.js

   # Способ 2: Через port-forwarding
   kubectl port-forward -n tasker-test svc/tasker-app-test 30001:8080 &
   echo "127.0.0.1 tasker-test.k8s-5.sa" | sudo tee -a /etc/hosts
   k6 run load-test.js

   # Способ 3: Через Nginx балансировщик (если настроен)
   k6 run -e TASKER_URL=http://tasker-test.k8s-5.sa load-test.js
   ```

## Параметры нагрузочного теста

Сценарий тестирования включает несколько этапов:

1. Постепенное увеличение нагрузки от 1 до 10 виртуальных пользователей (30 сек)
2. Стабильная нагрузка 10 пользователей (1 мин)
3. Увеличение до 20 пользователей (30 сек)
4. Стабильная нагрузка 20 пользователей (1 мин)
5. Постепенное снижение до 0 (30 сек)

Дополнительно запускается отдельный сценарий сложных операций с 5 постоянными пользователями в течение 2 минут.

## Пороговые значения

- 95% запросов должны быть обработаны быстрее 500 мс
- Менее 1% запросов должны завершаться ошибкой
- 95% операций с задачами должны быть завершены менее чем за 300 мс

## Интеграция с CI/CD

Тесты производительности автоматически запускаются при:

- Пуше в ветки master и develop
- Создании пулл-реквестов в ветку master
- По расписанию (еженедельно)

В CI/CD окружении:

1. Создается тестовое окружение в minikube
2. Настраивается port-forwarding для доступа к сервису
3. Добавляется запись в /etc/hosts для соответствия схеме доменных имен

Результаты тестов:

- Записываются в артефакты сборки
- Отправляются в Slack
- Для пулл-реквестов добавляются как комментарии

## Дополнительные инструменты

- **Grafana K6 Cloud**: для более детального анализа результатов можно настроить отправку в K6 Cloud:

  ```bash
  k6 login cloud
  k6 run --out cloud load-test.js
  ```

- **Prometheus + Grafana**: для мониторинга в реальном времени:
  ```bash
  k6 run --out prometheus load-test.js
  ```
