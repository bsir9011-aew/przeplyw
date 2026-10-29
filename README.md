# PRZEPŁYW · Network Failure Scenarios

Trzy mobilne laboratoria: ACL, Gateway i VLAN. Wybierz problem, przewidź → uruchom → prześledź decyzje → zmień konfigurację → sprawdź ponownie.

## Uruchomienie

Node 22.12+ lub 24 LTS oraz npm.

```sh
npm ci
npm run dev
```

Otwórz adres wyświetlony przez Vite ze ścieżką `/przeplyw/`. Telefon w tej samej sieci może użyć adresu komputera i portu 5173. W Codespaces przekieruj port 5173. Build: `npm run build`, podgląd: `npx vite preview --host 0.0.0.0`.

## Ćwiczenie

1. Wybierz ACL, Gateway lub VLAN. Przycisk „Wznów” prowadzi do zachowanego postępu danego laboratorium.
2. Dotknij urządzeń, aby obejrzeć aktualną konfigurację, adresację i przypisania portów.
3. Dodaj drogę przyciskami urządzeń (PC1 jest już wybrany), wskaż miejsce zakończenia i przyczynę. Uruchom symulację.
4. Przejrzyj ślad i pierwszą rozbieżność. Dopiero po pierwszej próbie odblokowany jest edytor właściwego parametru:
   - ACL: kolejność dwóch reguł R1.
   - Gateway: adres IPv4 bramy PC1.
   - VLAN: przypisanie portu SW1:p2 do VLAN (1–4094).
5. Przetestuj własną zmianę i nowe przewidywanie. Cel jest sprawdzany przez dostarczenie TCP/443 i zachowanie blokady TCP/22. Możesz cofnąć zmianę.
6. Wróć do wyboru laboratoriów. Konfiguracja, próby, przewidywanie, cofnięcie i krok odtwarzania są przechowywane osobno dla każdego laboratorium.

Gateway rozróżnia adres bramy poza podsiecią hosta (`GATEWAY_OUTSIDE_SUBNET`) od lokalnego adresu bez osiągalnego sąsiada (`GATEWAY_UNREACHABLE`). Brak osiągalności znanego interfejsu bramy przez niespójne VLAN pozostaje problemem L2. Są to obliczenia konfiguracji i łączy, nie odpowiedzi przypisane do identyfikatorów zadań. Router nie zmienia VLAN pakietu IP; na wyjściu tworzy nową ramkę.

## Model i ograniczenia

Czysty moduł TypeScript bez Reacta oblicza podsieci, bramę, logiczną osiągalność sąsiada przez aktywne łącza i porty access tego samego VLAN, trasy bezpośrednio podłączone oraz pierwsze dopasowanie bezstanowej ACL forward (domyślnie DENY). Router zmienia adresy MAC kolejnego odcinka, zachowując IP. Ślad zawiera fakty wykorzystane przez UI i ocenę przewidywania.

Zakres: jedna jawna topologia PC1–SW1–R1–SERVER, jeden router, hosty z jednym interfejsem, brak pętli. Model L2 zastępuje ARP i uczenie MAC logicznym sprawdzeniem osiągalności. Nie odtwarzamy ramek ARP, floodingu ani pełnego przełączania. Bez NAT, TTL, TCP handshake, TLS, ruchu zwrotnego i potwierdzania dostępności usługi. Dostarczony pakiet TCP/443 nie oznacza działającego HTTPS.

Przewidywanie jest przypisane do rewizji konfiguracji; po zmianie i cofnięciu trzeba wykonać nowe. Sesja zapisuje się automatycznie w IndexedDB przez `idb`: konfiguracja i cofnięcie zmiany, rozpoczęte przewidywanie, historia prób, wyniki, oceny, wybrane urządzenie i krok odtwarzania. Poczekaj na status „Sesja zapisana na tym urządzeniu” przed zamknięciem.

Przy uruchomieniu aplikacja czeka na odczyt przed odblokowaniem ćwiczenia, żeby pusty stan nie nadpisał zapisu. Format 2 przechowuje identyfikator aktywnego laboratorium, widok wyboru i osobne sesje. Zapis formatu 1 z PR #2 jest migrowany do ACL z zachowaniem konfiguracji, historii, przewidywania, cofnięcia i bieżącej próby/kroku. Oryginalny rekord pozostaje w tym samym magazynie pod kluczem `backup-pr2`, zanim nowy format może nadpisać `active`. Nieznane lub uszkodzone dane są zachowywane pod `backup-unrecognized` przed rozpoczęciem nowej sesji. Kopie nie są automatycznie kasowane. W razie błędu utworzenia kopii aplikacja przechodzi do pracy w pamięci i nie zastępuje oryginału. Wyniki i feedback są przeliczane z zapisanej konfiguracji prób. Niedostępny IndexedDB lub błąd zapisu przełącza aplikację na pamięć z wyraźnym statusem. Dane są lokalne dla przeglądarki i domeny: czyszczenie danych witryny lub usunięcie ich przez przeglądarkę może skasować postęp. Bez kont i synchronizacji.

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

Build dodatkowo sprawdza manifest, bazę i scope, rozmiary PNG oraz pokrycie zasobów przez precache. PWA i workflow Pages pozostają bez zmian. Mobile QA pozostaje PENDING. Dane scenariuszy są w `src/scenarios/labs.ts`; silnik nie zna ich identyfikatorów.
