# PRZEPŁYW · First Interactive Network Lab

Mobilne laboratorium: przewidź → uruchom → prześledź decyzje → zmień kolejność ACL → sprawdź ponownie.

## Uruchomienie

Node 22.12+ lub 24 LTS oraz npm.

```sh
npm ci
npm run dev
```

Otwórz adres wyświetlony przez Vite ze ścieżką `/przeplyw/`. Telefon w tej samej sieci może użyć adresu komputera i portu 5173. W Codespaces przekieruj port 5173. Build: `npm run build`, podgląd: `npx vite preview --host 0.0.0.0`.

## Ćwiczenie

1. Dotknij urządzeń, aby obejrzeć konfigurację.
2. Dodaj drogę przyciskami PC1, SW1, R1, SERVER (PC1 jest już wybrany); usuń ostatni element przyciskiem ↶.
3. Wybierz miejsce zakończenia i przyczynę, uruchom symulację.
4. Krokami przejrzyj decyzje, porównaj przewidywanie i faktyczny wynik.
5. Zamień kolejność reguł R1. Wykonaj nowe przewidywanie i uruchom próbę. Testy celu pokażą osobno TCP/443 oraz TCP/22.

## Model i ograniczenia

Czysty moduł TypeScript bez Reacta oblicza podsieci, bramę, logiczną osiągalność sąsiada przez aktywne łącza i porty access tego samego VLAN, trasy bezpośrednio podłączone oraz pierwsze dopasowanie bezstanowej ACL forward (domyślnie DENY). Router zmienia adresy MAC kolejnego odcinka, zachowując IP. Ślad zawiera fakty wykorzystane przez UI i ocenę przewidywania.

Zakres: jedna jawna topologia PC1–SW1–R1–SERVER, jeden router, hosty z jednym interfejsem, brak pętli. Model L2 zastępuje ARP i uczenie MAC logicznym sprawdzeniem osiągalności. Nie odtwarzamy ramek ARP, floodingu ani pełnego przełączania. Bez NAT, TTL, TCP handshake, TLS, ruchu zwrotnego i potwierdzania dostępności usługi. Dostarczony pakiet TCP/443 nie oznacza działającego HTTPS.

Przewidywanie jest przypisane do rewizji konfiguracji; po zmianie i cofnięciu trzeba wykonać nowe. Sesja zapisuje się automatycznie w IndexedDB przez `idb`: konfiguracja i cofnięcie zmiany, rozpoczęte przewidywanie, historia prób, wyniki, oceny, wybrane urządzenie i krok odtwarzania. Poczekaj na status „Sesja zapisana na tym urządzeniu” przed zamknięciem.

Przy uruchomieniu aplikacja czeka na odczyt przed odblokowaniem ćwiczenia, żeby pusty stan nie nadpisał zapisu. Wersjonujemy format, scenariusz i silnik; niezgodny lub uszkodzony zapis rozpoczyna nowe ćwiczenie z komunikatem. Wyniki i feedback są przeliczane z zapisanej konfiguracji prób. Niedostępny IndexedDB lub błąd zapisu przełącza aplikację na pamięć z wyraźnym statusem. Dane są lokalne dla przeglądarki i domeny: czyszczenie danych witryny lub usunięcie ich przez przeglądarkę może skasować postęp. Bez kont i synchronizacji.

## PWA, instalacja i offline

Produkcyjna baza aplikacji to `/przeplyw/`. Manifest ma zgodny `id`, `scope`, `start_url`, `display: standalone` oraz własne PNG 192 i 512 px. Service worker generowany przez `vite-plugin-pwa` precache'uje HTML, skrypty, CSS, ikony i manifest. Fonty są systemowe, bez zewnętrznych zapytań. Service worker jest wyłączony w development.

```sh
npm run build
npm run preview
```

Otwórz `http://localhost:4173/przeplyw/` na komputerze. PWA wymaga HTTPS albo lokalnego bezpiecznego kontekstu (`localhost`). HTTP pod adresem IP komputera na telefonie wystarczy do podglądu, ale nie jest poprawnym testem instalacji/offline.

Na Androidzie otwórz produkcyjny adres w przeglądarce obsługującej instalację PWA, np. Chrome lub Samsung Internet. Poczekaj na przygotowanie offline, wybierz z menu „Zainstaluj aplikację” / „Dodaj do ekranu głównego” (nazwa zależy od przeglądarki), potwierdź i uruchom ikonę PRZEPŁYW.

Nowy service worker czeka na decyzję użytkownika. Przycisk „Zapisz i zaktualizuj” najpierw kończy kolejkę zapisów oraz zapisuje bieżący stan; dopiero wtedy aktywuje nową wersję i odświeża aplikację. Nie ma automatycznego odświeżania podczas ćwiczenia. Jeśli trwały zapis jest niedostępny, aktualizacja w tej sesji jest zablokowana. Sprawdzanie aktualizacji odbywa się także po powrocie do aplikacji z dostępem do sieci.

## GitHub Pages

Jednorazowo: **Settings → Pages → Build and deployment → Source → GitHub Actions**.

Po scaleniu PR do `main` workflow `.github/workflows/pages.yml` uruchamia kontrole, buduje produkcyjną aplikację i wdraża `dist` przez oficjalne akcje Pages. Można go też uruchomić ręcznie w Actions. Docelowy adres po udanym wdrożeniu: **https://bsir9011-aew.github.io/przeplyw/**. Utworzenie PR nie wdraża go na produkcję.

## Procedura QA

1. Otwórz produkcyjny build online; poczekaj na „Gotowa do pracy offline” i zapis sesji.
2. Wykonaj pierwszą próbę, zmień ACL, rozpocznij nowe przewidywanie. Poczekaj na zapis.
3. Zamknij i otwórz aplikację. Sprawdź konfigurację, historię, możliwość cofnięcia oraz rozpoczęte przewidywanie. Po uruchomieniu próby przejdź o kilka kroków, zamknij i sprawdź wznowienie od tego kroku.
4. W DevTools zaznacz Offline lub na telefonie włącz tryb samolotowy. Otwórz ponownie aplikację; wykonaj próbę, zmień reguły, zapisz i uruchom jeszcze raz offline. Nie włączaj „Bypass for network”.
5. Przy testowaniu aktualizacji pozostaw starą wersję otwartą i wdróż nowy build. Po powrocie online powinien pojawić się przycisk aktualizacji bez automatycznego przeładowania. Zapisz i zaktualizuj; stan ma zostać przywrócony.
6. **PENDING - Mobile QA:** instalacja na Samsung Galaxy A53, uruchomienie standalone, widok 360–400 px, zimny start offline i zachowanie po ponownym uruchomieniu telefonu.

Testów instalacji, standalone i offline w prawdziwej przeglądarce nie należy utożsamiać ze statyczną kontrolą buildu. W środowisku implementacji nie ma dostępnego Chromium; nie instalowano kolejnych dużych narzędzi. Te kontrole przeglądarkowe pozostają do wykonania. Testy IndexedDB używają `fake-indexeddb` wyłącznie jako zależności deweloperskiej.

## Kontrole

```sh
npm run typecheck
npm run lint
npm test -- --run
npm run build
```

Testy sprawdzają mechanikę i feedback, nie wygląd ani strukturę komponentów. Interfejs obsługuje krokowanie bez automatycznej animacji, duże przyciski, fokus klawiatury i ograniczenie ruchu. Na telefonie sprawdź przewidywanie, zmianę ACL, cofnięcie oraz historię.

Build dodatkowo sprawdza manifest, bazę i scope, rozmiary PNG oraz pokrycie zasobów przez precache. Nie dodano nowych laboratoriów ani możliwości symulatora.
