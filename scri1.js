//626d8d260d921caff14e0afb1daded65

$(document).ready(function () {

const apiKey = "626d8d260d921caff14e0afb1daded65";
let currentCategory = "popular";
  let appMode = "list"; 
  let currentSearchQuery = "";

  const categoryTitles = {
    popular: "Popular Movies",
    top_rated: "Top Rated Movies",
    now_playing: "Now Playing Movies",
    upcoming: "Upcoming Movies"
  };

  let lastScroll = 0;
  let currentPage = 1;
  let totalPages = 1;
  let lastPageLoaded = 1;

  let restoreScrollPending = false;
  let loadedMovieCount = 0;
  let upcomingCachedMovies = [];

  const regions = ["US", "GB", "CA", "FR", "DE", "AU"];
  let upcomingPages = {};
  let upcomingTotalPages = {};

  const moviesPerPage = 10;
  const MAX_RESULTS = 50;
  const MAX_PAGES = 5;


  $("html, body").css({
  scrollBehavior: "auto"
  });

  function scrollTo(el) {
  $("html, body").stop().animate({
    scrollTop: $(el).offset().top
  }, 300);
}


  //  Filter Upcoming 
function filterUpcomingMovies(movies) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return movies.filter(m => {
      const release = new Date(m.release_date);
      return !isNaN(release) && release >= tomorrow;
    });
  } 

  function resetSearchView() {
    $("#searchView").hide();
    $("#searchInput").val("");
  }


  // LOAD MOVIES
  

  function loadMovies(endpoint, page = 1) {
  currentCategory = endpoint;
  resetSearchView();

  const scrollPos = $(window).scrollTop();
  const oldHeight = $("#homeView").height();
  //$("#homeView").css("min-height", oldHeight);
  //$(window).scrollTop(scrollPos);

  //$("#homeView").html("<p></p>");
  $("#homeView").html(`<div style="height:${oldHeight}px"></div>`);
  //$("#homeViewContent").html("<p>Loading...</p>");
  $(window).scrollTop(scrollPos);

  if (endpoint === "upcoming") {
      loadUpcomingMoviesMultipleRegions(regions, page);
      return;
  }

  $.ajax({
    url: `https://api.themoviedb.org/3/movie/${endpoint}`,
    method: "GET",
    data: { api_key: apiKey, page },
    success: function (data) {
      currentPage = data.page;
      //totalPages = data.total_pages;
      totalPages = Math.min(data.total_pages, MAX_PAGES);
      lastPageLoaded = data.page;  

      const moviesToDisplay = data.results.slice(0, moviesPerPage);
      displayMovies(moviesToDisplay);
      renderPagination(totalPages, currentPage); 
    },
    error: function () {
      $("#homeView").html("<p>Error loading movies</p>");
    }
  });
}

  function loadMoreMovies(pageToLoad) {
    const nextPage = pageToLoad || (currentPage + 1);
    if (currentPage >= MAX_PAGES) return;
    resetSearchView();

    let url = currentCategory === "search"
      ? "https://api.themoviedb.org/3/search/movie"
      : `https://api.themoviedb.org/3/movie/${currentCategory}`;

    $.ajax({
      url: url,
      method: "GET",
      data: { api_key: apiKey, page: nextPage, query: currentSearchQuery },
      success: function (data) {
        currentPage = data.page;
        totalPages = Math.min(data.total_pages, MAX_PAGES);
        lastPageLoaded = data.page;

        if (currentCategory === "upcoming") {
          // handle upcoming separately
          return;
        }

        const moviesToShow = data.results.slice(0, moviesPerPage);
        
        appendMovies(moviesToShow);
        renderPagination(totalPages, currentPage); 
      }
    });
  }

  // UPCOMING MULTI-REGION
  function loadUpcomingMoviesMultipleRegions(regions, page = 1) {
    $("#homeView").html("<p></p>");

    // For multi-region, reset pages only on first load
    if (page === 1) {
        regions.forEach(r => upcomingPages[r] = 1);
        regions.forEach(r => upcomingTotalPages[r] = 1);
    }

    const requests = regions.map(r =>
      $.ajax({
        url: "https://api.themoviedb.org/3/movie/upcoming",
        method: "GET",
        data: { api_key: apiKey, region: r, page: 1 }
      })
    );

    $.when(...requests).done(function(...responses) {
        let allMovies = [];
        responses.forEach((r, i) => {
            const data = r[0];
            const region = regions[i];
            upcomingTotalPages[region] = data.total_pages || 1;
            if (data.results) allMovies = allMovies.concat(data.results);
        });

        // Deduplicate by ID, keep latest release date
        const movieMap = new Map();
        allMovies.forEach(movie => {
            const release = new Date(movie.release_date);
            const existing = movieMap.get(movie.id);
            if (!existing || release > new Date(existing.release_date)) {
                movieMap.set(movie.id, movie);
            }
        });

        const dedupedMovies = Array.from(movieMap.values());
        const upcomingFiltered = filterUpcomingMovies(dedupedMovies);
        upcomingCachedMovies = upcomingFiltered.slice(0, MAX_RESULTS);

        // Calculate slice
        const limitedUpcoming = upcomingFiltered.slice(0, MAX_RESULTS);

        const moviesToShow = limitedUpcoming.slice(
            (page - 1) * moviesPerPage,
            page * moviesPerPage
        );
        displayMovies(moviesToShow);
        totalPages = MAX_PAGES;
        displayUpcomingPage(page);

        // Update currentPage
        currentPage = page;
        
    })
    .fail(() => {
        $("#homeView").html("<p>Error loading upcoming movies.</p>");
    });
}

  // DISPLAY & APPEND MOVIES
  function displayMovies(movies) {
    //$("#homeView").removeClass("detailed-view");
    $("#movieDetails").html("");
    $("#back-arrow").show();
    let title = categoryTitles[currentCategory] || "Movies";
    const startIndex = (currentPage - 1) * moviesPerPage + 1;
    const endIndex = Math.min((currentPage - 1) * moviesPerPage + movies.length, totalPages * moviesPerPage);
    const totalResults = Math.min(MAX_RESULTS, totalPages * moviesPerPage);
    const resultText = `Showing ${startIndex}–${endIndex} of ${totalResults} results`;

  let html = `
    <h2 class="category-title">${title}</h2>
    <p class="results-info" style="text-align:center;">${resultText}</p>
    <div class="movie-grid">
  `;

    movies.forEach(function(movie) {
      let imageUrl = movie.poster_path
        ? "https://image.tmdb.org/t/p/w300" + movie.poster_path
        : "https://placehold.co/150?text=No+Image";
      let shortOverview = movie.overview.length > 100 ? movie.overview.substring(0, 100) + "..." : movie.overview;

      html += `<div class="movie-card" data-id="${movie.id}">
        <img src="${imageUrl}" alt="poster">
        <h3>${movie.title}</h3>
        <p>${shortOverview}</p>
      </div>`;
    });

    html += `</div><div id="pagination" class="pagination-container"></div>`;
    $("#homeView").html(html);
    //$("#homeViewContent").html(html);


    $(".movie-card").off("click").on("click", function () {
      loadedMovieCount = $(".movie-card").length;
      lastScroll = $(window).scrollTop();
      loadMovieDetails($(this).data("id"));
      //setTimeout(() => {
      //scrollTo("#homeView");
      //}, 100);
    });
  }

  function appendMovies(movies) {
    movies.forEach(function(movie) {
      let imageUrl = movie.poster_path
        ? "https://image.tmdb.org/t/p/w300" + movie.poster_path
        : "https://placehold.co/150?text=No+Image";
      let shortOverview = movie.overview.length > 100 ? movie.overview.substring(0, 100) + "..." : movie.overview;

      $(".movie-grid").append(`<div class="movie-card" data-id="${movie.id}">
        <img src="${imageUrl}" alt="poster">
        <h3>${movie.title}</h3>
        <p>${shortOverview}</p>
      </div>`);
    });

    $(".movie-card").off("click").on("click", function () {
      loadedMovieCount = $(".movie-card").length;
      lastScroll = $(window).scrollTop();
      loadMovieDetails($(this).data("id"));
      //setTimeout(() => {
      //scrollTo("#homeView");
      //}, 100);
    });
  }

function renderPagination(total, current) {
  total = Math.min(total, MAX_PAGES);

  let paginationHtml = '';

  for (let i = 1; i <= total; i++) {
    paginationHtml += `
      <button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  $("#pagination").html(paginationHtml);
}

$(document).on("click", ".page-btn", function() {
  const page = parseInt($(this).data("page"));
  currentPage = page;

  if (currentCategory === "search") {
    searchMovies(currentSearchQuery, page);

    requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $("html, body").stop(true).animate({
        scrollTop: $("#homeView").offset().top
      }, 350);
    });
    });
  } else if (currentCategory === "upcoming") {
    displayUpcomingPage(page);
    
    $("html, body").stop(true).animate({
      scrollTop: $("#homeView").offset().top
    }, 350);
  } else {
    loadMovies(currentCategory, page);
    
    requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $("html, body").stop(true).animate({
        scrollTop: $("#homeView").offset().top
      }, 350);
    });
    });
    
  }

});

function displayUpcomingPage(page) {
    currentPage = page;

    const start = (page - 1) * moviesPerPage;
    const end = page * moviesPerPage;

    const moviesToShow = upcomingCachedMovies.slice(start, end);

    displayMovies(moviesToShow);

    renderPagination(MAX_PAGES, page);
}

  


//  Reset Search 
function resetSearchView() {
  $("#searchView").hide();
  $("#searchInput").val("");
}





function loadMovieDetails(movieId) {
  $("#movieDetails").html("<p>Loading details...</p>");
  
  resetSearchView();

  // Fetch movie details
  $.ajax({
    url: `https://api.themoviedb.org/3/movie/${movieId}`,
    method: "GET",
    data: {
      api_key: apiKey,
      append_to_response: "credits" // this loads cast
    },
    success: function (data) {
      displayMovieDetails(data);
    },
    error: function () {
      $("#homeView").html("<p>Error loading movie details</p>");
    }
  });
}







function displayMovieDetails(movie) {
  //$("#homeView").addClass("detailed-view");
  //$("#back-arrow").hide();

  let imageUrl = movie.poster_path
    ? "https://image.tmdb.org/t/p/w300" + movie.poster_path
    : "https://placehold.co/150?text=No+Image";

  // Build genres badges
  let genreHtml = "";
  if (movie.genres) {
    movie.genres.forEach(g => {
      genreHtml += `<span>${g.name}</span>`;
    });
  }

  let castCrewHtml = renderCastCrew(movie.credits);

  // Build cast list (first 5 actors)
  let castHtml = "";
  if (movie.credits && movie.credits.cast) {
    movie.credits.cast.slice(0, 5).forEach(actor => {
      castHtml += `<li>${actor.name} as ${actor.character}</li>`;
    });
  }

  $("#movieDetails").html(`
  <button id="backBtn">← Close</button>
  <div class="movie-detail-row">
    <img src="${imageUrl}" alt="poster">
    <div class="movie-info">
      <h2>${movie.title}</h2>
      <p><strong>Release Date:</strong> ${movie.release_date}</p>
      <div class="rating">⭐ ${movie.vote_average}</div>
      <div class="genres">${genreHtml}</div>
      <p>${movie.overview}</p>
    </div>
  </div>
  <br>
  ${castCrewHtml} <!-- Places cast and crew outside row for full width -->
`);
goToMovieDetails();
}


function goToMovieDetails() {
  requestAnimationFrame(() => {
    const el = $("#movieDetails");
    if (!el.length) return;

    const navbarHeight = $(".navbar").outerHeight() || 0;
    const extraPadding = 20;


    $("html, body").stop(true).animate({
      scrollTop: el.offset().top - navbarHeight - extraPadding
    }, 400);
  });
}


$(document).on("click", "#closeDetailsBtn", function() {
    $("#movieDetails").html("");
});



function renderCastCrew(credits) {
  // Set how many initially visible
  const initialCount = 5;

  // Cast
  let html = "";
    html += `
    <div class="cast-section">
      <h3>Cast (${credits.cast.length})</h3>
      <div class="person-row cast-row">
    `;  
  
    credits.cast.forEach((actor, index) => {
    const imgUrl = actor.profile_path
      ? "https://image.tmdb.org/t/p/w185" + actor.profile_path
      : "https://placehold.co/150?text=No+Image";
    const hiddenClass = index >= initialCount ? 'hidden-person' : '';
    html += `
      <div class="person-card ${hiddenClass}">
        <img src="${imgUrl}" alt="${actor.name}">
        <p>${actor.name}</p>
        ${actor.character ? `<p style="font-size:0.7rem;color:#ccc;">plays ${actor.character}</p>` : ""}
      </div>
    `;
  });
  html += `
      </div>
      ${credits.cast.length > initialCount ? '<button class="view-more-btn" data-target="cast">View More</button>' : ""}
    </div>
  `;


  // Crew
    html += `
    <div class="crew-section">
      <h3>Crew (${credits.crew.length})</h3>
      <div class="person-row crew-row">
    `;  
    credits.crew.forEach((member, index) => {
    const imgUrl = member.profile_path
      ? "https://image.tmdb.org/t/p/w185" + member.profile_path
      : "https://placehold.co/150?text=No+Image";
    const hiddenClass = index >= initialCount ? 'hidden-person' : '';
    html += `
      <div class="person-card ${hiddenClass}">
        <img src="${imgUrl}" alt="${member.name}">
        <p>${member.name}</p>
        <p style="font-size:0.7rem;color:#ccc;">${member.job}</p>
      </div>
    `;
  });
  html += `
      </div>
      ${credits.crew.length > initialCount ? '<button class="view-more-btn" data-target="crew">View More</button>' : ""}
    </div>
  `;

  return html;
}





// Handle view more clicks
$(document).on('click', '.view-more-btn', function() {
  const btn = $(this);
  const rowDiv = btn.prev('.person-row'); // only toggle the previous row
  rowDiv.find('.hidden-person').slideToggle(); // toggle hidden cards
  // Swap button text correctly
  if (btn.text() === "View More") {
    btn.text("View Less");
  } else {
    btn.text("View More");
  }
});




// Search

function searchMovies(query, page = 1) {
  //$("#homeView").html("<p>Searching...</p>");
  const scrollPos = $(window).scrollTop();
  const oldHeight = $("#homeView").height();

  $("#homeView").html(`<div style="height:${oldHeight}px"></div>`);
  
  resetSearchView();
  appMode = "search";  
  currentCategory = "search";     
  currentSearchQuery = query; 

  $.ajax({
    url: "https://api.themoviedb.org/3/search/movie",
    method: "GET",
    data: { api_key: apiKey, query: query, page: page },
    success: function(data) {
      currentPage = data.page;
      totalPages = Math.min(data.total_pages, MAX_PAGES);
      displayMovies(data.results.slice(0, moviesPerPage));
      renderPagination(totalPages, currentPage);
    },
    error: function() {
      $("#homeView").html("<p>Error searching movies.</p>");
    }
  });
}


$("#searchForm").on("submit", function(e) {
  e.preventDefault();

  const query = $("#searchInput").val().trim();

  if (!query) return;

  searchMovies(query);


  $("html, body").animate({
    scrollTop: $("#homeView").offset().top - 70
  }, 300);
});



  //  Dropdown  

  function handleCategoryChange(category) {
  if (!category) return;
  currentCategory = category;
  loadMovies(category);
}

//  Select dropdown 
$("#categorySelect").change(function () {
  const selected = $(this).val();
  handleCategoryChange(selected);
});

//  Dropdown links 
$(document).on("click", ".dropdown-content a", function (e) {
  e.preventDefault();
  const category = $(this).data("category");
  handleCategoryChange(category);
});


const dropdown = document.querySelector(".dropdown");
const menu = dropdown.querySelector(".dropdown-content");
let hideTimeout;

dropdown.addEventListener("mouseenter", () => {
  clearTimeout(hideTimeout);          // cancel any hide delay
  menu.style.visibility = "visible";
  menu.style.opacity = "1";
  menu.style.pointerEvents = "auto";  // enable clicks
});

dropdown.addEventListener("mouseleave", () => {
  // Add a small delay to prevent flicker when moving fast
  hideTimeout = setTimeout(() => {
    menu.style.opacity = "0";
    menu.style.pointerEvents = "none";
    setTimeout(() => {
      menu.style.visibility = "hidden";
    }, 200); // matches transition
  }, 150); // delay before hiding
});








$(document).on('click', '#backBtn', function() {
    $("#homeView").removeClass("detailed-view");
    $("#categorySelect").val(currentCategory);

    if (currentCategory === "search") {
      
        searchMovies(currentSearchQuery, currentPage);


        let neededPages = Math.ceil(loadedMovieCount / 20);

        for (let i = 2; i <= neededPages; i++) {
            loadMoreMovies(i);
        }

    }

    else if (currentCategory === "upcoming") {
      displayUpcomingPage(currentPage);

    }

    else {

        loadMovies(currentCategory, lastPageLoaded);
        setTimeout(() => {
        $("html, body").stop().animate({
          scrollTop: lastScroll
        }, 400);
        }, 300);

    }

    requestAnimationFrame(() => {
    $("html, body").stop(true).animate({
      scrollTop: lastScroll
    }, 300);
    });
});



$("#homeBtn").click(function () {
  $("#searchView").hide();
  $("#homeView").show();

  $("#homeView").removeClass("detailed-view");

  let currentCategory = $("#categorySelect").val() || "popular";
  loadMovies(currentCategory);
});



$("#searchBtn").click(function () {
  $("#searchView").slideToggle();


  $("html, body").animate({
    scrollTop: 0
  }, 400)
}); 

$("#back-arrow").on("click", function () {
  window.location.href = "Projects.html";
});


  //  Initial Load 
  loadMovies(currentCategory);

});
